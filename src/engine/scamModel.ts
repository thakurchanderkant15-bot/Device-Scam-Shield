import {
  ActionRecommendation,
  AdaptiveMemoryState,
  AnalysisResult,
  ChannelType,
  DetectedLanguage,
  ExplanationPoint,
  HighlightedSpan,
  NeuralFeatureVector,
  RiskLevel,
  TacticScore,
  UrlForensicReport,
  VoiceTurn,
  VoiceTurnAssessment,
} from './types';

const ADAPTIVE_STORAGE_KEY = 'aegis_local_adaptive_memory_v1';

// Cyrillic, Greek, and lookalike Unicode homoglyphs mapped to Latin ASCII
const HOMOGLYPH_MAP: Record<string, string> = {
  '\u0430': 'a', '\u0410': 'A', // Cyrillic а, А
  '\u0435': 'e', '\u0415': 'E', // Cyrillic е, Е
  '\u043E': 'o', '\u041E': 'O', // Cyrillic о, О
  '\u0440': 'p', '\u0420': 'P', // Cyrillic р, Р
  '\u0441': 'c', '\u0421': 'C', // Cyrillic с, С
  '\u0445': 'x', '\u0425': 'X', // Cyrillic х, Х
  '\u0456': 'i', '\u0406': 'I', // Cyrillic і, І
  '\u0443': 'y', '\u0423': 'Y', // Cyrillic у, У
  '\u043A': 'k', '\u041A': 'K', // Cyrillic к, К
  '\u0442': 't', '\u0422': 'T', // Cyrillic т, Т
  '\u0412': 'B', '\u041C': 'M', '\u041D': 'H',
  '\u03B1': 'a', '\u03B5': 'e', '\u03BF': 'o', '\u03C1': 'p', '\u03BA': 'k',
  '\u03B9': 'i', '\u03C5': 'u', '\u03BD': 'v',
  '\u0131': 'i', '\u0142': 'l', '\u0261': 'g',
};

const ZERO_WIDTH_REGEX = /[\u200B-\u200D\uFEFF\u00AD\u2060]/g;

const TRUSTED_BRANDS = [
  'paypal', 'chase', 'wellsfargo', 'bankofamerica', 'citibank', 'capitalone',
  'hsbc', 'barclays', 'lloyds', 'santander', 'hdfc', 'icici', 'sbi',
  'apple', 'icloud', 'microsoft', 'office365', 'google', 'gmail', 'amazon',
  'netflix', 'fedex', 'ups', 'usps', 'dhl', 'royalmail', 'irs', 'hmrc',
  'medicare', 'ssa', 'coinbase', 'binance', 'metamask', 'whatsapp', 'telegram',
  'workday', 'adp', 'docusign', 'stripe', 'zelle', 'venmo', 'cashapp',
];

const SUSPICIOUS_TLDS = new Set([
  'xyz', 'top', 'click', 'loan', 'buzz', 'gq', 'tk', 'ml', 'cf', 'ga',
  'icu', 'vip', 'cam', 'work', 'rest', 'fit', 'monster', 'surf', 'support',
  'cyou', 'cfd', 'sbs', 'live', 'online', 'site', 'shop', 'info',
]);

const URL_SHORTENERS = new Set([
  'bit.ly', 'tinyurl.com', 't.co', 'cutt.ly', 'rb.gy', 'is.gd', 'ow.ly',
  'shorturl.at', 'tiny.cc', 'v.gd', 'rebrand.ly',
]);

// 64-dimensional semantic anchor training prototypes (Scam vs Legitimate intents across languages)
// Used to compute subword n-gram cosine similarity in a 64-d projection space without rigid exact-keyword matching.
const SCAM_INTENT_PROTOTYPES = [
  'urgent action required account suspended verify immediately avoid permanent closure',
  'unusual activity detected confirm your identity otp pin password banking security',
  'package delivery failed unpaid customs fee update shipping address reschedule',
  'tax refund penalty arrest warrant legal action call federal officer immediately',
  'send gift card wire transfer crypto usdt zelle payment keep secret do not tell anyone',
  'download anydesk teamviewer remote access screen share fix virus refund error',
  'grandma mom broke phone new number emergency need money fast wire today',
  'guaranteed daily profit crypto investment airdrop claim wallet seed phrase',
  'hr payroll direct deposit compliance reauthenticate employee portal before deadline',
  'alerta seguridad cuenta bloqueada verificar clave banco inmediato enlace',
  'su paquete retenido aduana pagar tarifa entrega urgente confirmar enlace',
  'aapka khata band ho jayega kyc update otp verify karein turant link',
  'alerte securite compte suspendu confirmer identite carte bancaire immediat',
  'kontosperrung dringend identitat bestatigen tan sicherheit link',
];

const LEGIT_INTENT_PROTOTYPES = [
  'your card ending in was charged at merchant if you recognize this purchase no action needed',
  'your verification code is do not share this code with anyone staff will never ask for it',
  'appointment reminder clinic tomorrow morning reply confirm or call office front desk',
  'meeting rescheduled to afternoon calendar invite updated see you in conference room',
  'monthly statement is now ready sign in through the official app to view',
  'order shipped expected arrival friday track inside your account dashboard',
  'dinner tonight at seven pick up groceries on the way home thanks',
  'two factor code requested if this was not you change password in settings',
  'prescription ready for pickup at pharmacy during regular business hours',
  'recordatorio cita medica manana por la manana confirmar asistencia recepcion',
];

const VECTOR_DIM = 64;

function fnv1aHash(str: string, seed = 2166136261): number {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function normalizeLeetspeak(word: string): string {
  // Only apply leetspeak substitution to tokens mixing letters and digits/symbols
  if (!/[a-zA-Z]/.test(word) || !/[0-9@$!]/.test(word)) {
    return word;
  }
  return word
    .replace(/0/g, 'o')
    .replace(/[1!|]/g, 'i')
    .replace(/3/g, 'e')
    .replace(/[4@]/g, 'a')
    .replace(/[5$]/g, 's')
    .replace(/7/g, 't')
    .replace(/8/g, 'b')
    .replace(/9/g, 'g');
}

export function deobfuscateText(raw: string): {
  cleaned: string;
  homoglyphCount: number;
  zeroWidthCount: number;
  leetspeakTokens: string[];
} {
  let zeroWidthCount = 0;
  const withoutZeroWidth = raw.replace(ZERO_WIDTH_REGEX, () => {
    zeroWidthCount++;
    return '';
  });

  let homoglyphCount = 0;
  let mapped = '';
  for (const ch of withoutZeroWidth) {
    if (HOMOGLYPH_MAP[ch]) {
      mapped += HOMOGLYPH_MAP[ch];
      homoglyphCount++;
    } else {
      mapped += ch;
    }
  }

  // Normalize defanged URLs like hxxp:// or [.]
  const defangNormalized = mapped
    .replace(/\bhxxps?:\/\//gi, (m) => (m.toLowerCase().startsWith('hxxps') ? 'https://' : 'http://'))
    .replace(/\[\.\]/g, '.');

  const leetspeakTokens: string[] = [];
  const words = defangNormalized.split(/(\s+)/);
  const normalizedWords = words.map((part) => {
    if (/^\s+$/.test(part)) return part;
    // Skip pure URLs/numbers from leetspeak conversion
    if (/^https?:\/\//i.test(part) || /^\d+([.,]\d+)?$/.test(part)) return part;
    const stripped = part.replace(/^[^a-zA-Z0-9@$!]+|[^a-zA-Z0-9@$!]+$/g, '');
    if (stripped.length >= 3 && /[a-zA-Z]/.test(stripped) && /[0-9@$!]/.test(stripped)) {
      const converted = normalizeLeetspeak(stripped);
      if (converted !== stripped) {
        leetspeakTokens.push(stripped);
        return part.replace(stripped, converted);
      }
    }
    return part;
  });

  return {
    cleaned: normalizedWords.join(''),
    homoglyphCount,
    zeroWidthCount,
    leetspeakTokens,
  };
}

function embedSubwordVector(text: string): Float64Array {
  const vec = new Float64Array(VECTOR_DIM);
  const cleaned = text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' __url__ ')
    .replace(/[^a-z0-9\s_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return vec;

  const tokens = cleaned.split(' ');
  for (let t = 0; t < tokens.length; t++) {
    const token = tokens[t];
    if (!token) continue;

    // Whole word feature
    const wh = fnv1aHash(`w:${token}`);
    vec[wh % VECTOR_DIM] += (wh & 1 ? 1 : -1) * 1.3;

    // Word bigram feature
    if (t < tokens.length - 1) {
      const bh = fnv1aHash(`b:${token}_${tokens[t + 1]}`);
      vec[bh % VECTOR_DIM] += (bh & 1 ? 1 : -1) * 1.1;
    }

    // Character 3-grams and 4-grams (enables robust unseen & multilingual/typo generalization)
    const padded = `^${token}$`;
    for (let i = 0; i <= padded.length - 3; i++) {
      const tri = padded.slice(i, i + 3);
      const th = fnv1aHash(`3:${tri}`);
      vec[th % VECTOR_DIM] += (th & 1 ? 1 : -1) * 0.45;
    }
    for (let i = 0; i <= padded.length - 4; i++) {
      const quad = padded.slice(i, i + 4);
      const qh = fnv1aHash(`4:${quad}`);
      vec[qh % VECTOR_DIM] += (qh & 1 ? 1 : -1) * 0.55;
    }
  }

  // L2 normalize
  let norm = 0;
  for (let i = 0; i < VECTOR_DIM; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < VECTOR_DIM; i++) vec[i] /= norm;
  }
  return vec;
}

function buildCentroid(corpus: string[]): Float64Array {
  const centroid = new Float64Array(VECTOR_DIM);
  for (const doc of corpus) {
    const v = embedSubwordVector(doc);
    for (let i = 0; i < VECTOR_DIM; i++) centroid[i] += v[i];
  }
  let norm = 0;
  for (let i = 0; i < VECTOR_DIM; i++) norm += centroid[i] * centroid[i];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < VECTOR_DIM; i++) centroid[i] /= norm;
  }
  return centroid;
}

function cosineSimilarity(a: Float64Array, b: Float64Array): number {
  let dot = 0;
  for (let i = 0; i < VECTOR_DIM; i++) dot += a[i] * b[i];
  return dot;
}

const SCAM_CENTROID = buildCentroid(SCAM_INTENT_PROTOTYPES);
const LEGIT_CENTROID = buildCentroid(LEGIT_INTENT_PROTOTYPES);

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

export function extractAndAnalyzeUrls(rawText: string, cleanedText: string): UrlForensicReport[] {
  const urlPattern = /(?:https?:\/\/|hxxps?:\/\/|www\.)[^\s<>"')]+|\b[a-zA-Z0-9-]+(?:\[\.\]|\.)[a-zA-Z0-9.-]*\.(?:com|net|org|xyz|top|click|info|support|icu|vip|tk|ml|ga|cf|gq|live|online|site|shop|co|io|uk|in|es|de|fr|me|cc|biz)(?:\/[^\s<>"')]*)?/gi;

  const rawMatches = Array.from(rawText.matchAll(urlPattern)).map((m) => m[0]);
  const cleanMatches = Array.from(cleanedText.matchAll(urlPattern)).map((m) => m[0]);
  const candidates = rawMatches.length >= cleanMatches.length ? rawMatches : cleanMatches;

  const seen = new Set<string>();
  const reports: UrlForensicReport[] = [];

  for (let idx = 0; idx < candidates.length; idx++) {
    const rawUrl = candidates[idx].replace(/[.,;!?]+$/, '');
    if (seen.has(rawUrl.toLowerCase())) continue;
    seen.add(rawUrl.toLowerCase());

    const { cleaned: deobfUrl, homoglyphCount } = deobfuscateText(rawUrl);
    const withProtocol = /^https?:\/\//i.test(deobfUrl) ? deobfUrl : `https://${deobfUrl}`;

    let parsed: URL | null = null;
    try {
      parsed = new URL(withProtocol);
    } catch {
      parsed = null;
    }

    const hostname = parsed ? parsed.hostname.toLowerCase() : deobfUrl.split('/')[0].toLowerCase();
    const parts = hostname.split('.').filter(Boolean);
    const tld = parts.length >= 2 ? parts[parts.length - 1] : '';
    const registrableDomain = parts.length >= 2 ? `${parts[parts.length - 2]}.${tld}` : hostname;
    const sld = parts.length >= 2 ? parts[parts.length - 2] : hostname;
    const subdomain = parts.length > 2 ? parts.slice(0, -2).join('.') : '';
    const path = parsed ? `${parsed.pathname}${parsed.search}` : '';

    const flags: string[] = [];
    let score = 0;
    let impersonatedBrand: string | null = null;

    if (homoglyphCount > 0 || /[^\x00-\x7F]/.test(rawUrl) || hostname.includes('xn--')) {
      flags.push('Internationalized / homoglyph lookalike characters detected');
      score += 48;
    }

    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
      flags.push('Direct IP address host instead of named domain');
      score += 42;
    }

    if (rawUrl.toLowerCase().startsWith('http://')) {
      flags.push('Unencrypted HTTP link');
      score += 18;
    }

    if (parsed && (parsed.username || parsed.password || rawUrl.includes('@'))) {
      flags.push('Embedded "@" credential deception in URL authority');
      score += 45;
    }

    if (URL_SHORTENERS.has(registrableDomain)) {
      flags.push(`Destination masked behind URL shortener (${registrableDomain})`);
      score += 28;
    }

    if (SUSPICIOUS_TLDS.has(tld)) {
      flags.push(`High-abuse top-level domain (.${tld})`);
      score += 26;
    }

    if (parts.length >= 4) {
      flags.push(`Excessive subdomain depth (${parts.length - 2} nested labels)`);
      score += 18;
    }

    if ((sld.match(/-/g) || []).length >= 2) {
      flags.push('Multi-hyphenated deceptive domain label');
      score += 16;
    }

    // Brand impersonation check (exact official domain vs lookalike / subdomain trap)
    for (const brand of TRUSTED_BRANDS) {
      const exactOfficial =
        sld === brand &&
        ['com', 'org', 'gov', 'edu', 'co', 'net', 'io'].includes(tld) &&
        !subdomain.includes('verify') &&
        !subdomain.includes('login');

      if (exactOfficial) continue;

      // Brand buried in subdomain or concatenated with security lure words
      if (subdomain.includes(brand) || (sld.includes(brand) && sld !== brand)) {
        impersonatedBrand = brand;
        flags.push(`Impersonates "${brand}" inside non-official domain "${registrableDomain}"`);
        score += 40;
        break;
      }

      // Typosquatting via Levenshtein distance
      if (sld.length >= 4 && Math.abs(sld.length - brand.length) <= 2) {
        const dist = levenshtein(sld, brand);
        if (dist > 0 && dist <= (brand.length >= 7 ? 2 : 1)) {
          impersonatedBrand = brand;
          flags.push(`Typosquatting similarity to "${brand}" (edit distance ${dist})`);
          score += 44;
          break;
        }
      }
    }

    if (/(login|verify|secure|auth|update|kyc|wallet|refund|claim|unlock|billing)/i.test(hostname + path) && score >= 16) {
      flags.push('Credential or payment harvesting path structure');
      score += 14;
    }

    reports.push({
      rawUrl,
      normalizedUrl: deobfUrl,
      protocol: parsed ? parsed.protocol.replace(':', '') : 'https',
      subdomain,
      registrableDomain,
      tld,
      path: path || '/',
      impersonatedBrand,
      riskScore: Math.min(100, score),
      flags: flags.length > 0 ? flags : ['No structural anomalies detected in domain anatomy'],
    });
  }

  return reports;
}

function detectLanguage(text: string): DetectedLanguage {
  const lower = text.toLowerCase();
  const spanishHits = (lower.match(/\b(su|cuenta|banco|urgente|clave|bloqueada|enlace|paquete|verificar|inmediato|hola|tarjeta)\b/g) || []).length;
  const hindiHits = (lower.match(/\b(aapka|khata|band|karein|turant|baje|paisa|bhejein|rupaye|link|par|hai|ho|jayega|sampark)\b/g) || []).length;
  const frenchHits = (lower.match(/\b(votre|compte|suspendu|veuillez|cliquer|carte|bancaire|immédiat|securite|colis)\b/g) || []).length;
  const germanHits = (lower.match(/\b(ihr|konto|gesperrt|dringend|bestätigen|sofort|paket|sicherheit|überweisung)\b/g) || []).length;

  const scores: Array<[DetectedLanguage, number]> = [
    ['Spanish', spanishHits],
    ['Hindi / Hinglish', hindiHits],
    ['French', frenchHits],
    ['German', germanHits],
  ];
  scores.sort((a, b) => b[1] - a[1]);
  if (scores[0][1] >= 2) return scores[0][0];
  if (scores[0][1] === 1 && /\b(the|your|you|is|are|please|account|click)\b/i.test(lower)) {
    return 'Multilingual';
  }
  return 'English';
}

// Pattern clusters for explainable span attribution & behavioral scoring
interface SignalRule {
  category: HighlightedSpan['category'];
  regex: RegExp;
  weight: number;
  reason: string;
}

const SIGNAL_RULES: SignalRule[] = [
  {
    category: 'urgency',
    regex: /\b(urgent|immediately|right now|within \d+ (?:hours?|minutes?|hrs?)|expires? today|final warning|final notice|last chance|act now|before (?:midnight|(?:[a-z]+ )?\d{1,2} ?pm|today)|suspended|permanently closed|locked|frozen|deactivated|warrant|arrest|seized|trojan|spyware|malware|virus detected|compromised|at risk|turant|inmediato|urgente|sofort|dringend|immédiatement|immediatement|aaj shaam|band ho jayega|bloqueada)\b/gi,
    weight: 22,
    reason: 'Creates artificial time pressure or fear of immediate penalty',
  },
  {
    category: 'impersonation',
    regex: /\b(irs|hmrc|social security|ssa|medicare|federal|customs|border|police|fraud department|security team|tech support|microsoft|apple support|payroll|hr department|hr notice|customer care|courier|usps|fedex|ups|dhl|royal mail|banco|seguridad bancaria|aduana|douane)\b/gi,
    weight: 18,
    reason: 'Claims authority or trusted institutional identity',
  },
  {
    category: 'extraction',
    regex: /\b(otp|one[- ]time[- ]passcode|6[- ]digit code|pin|cvv|passcode|password|seed phrase|recovery phrase|private key|gift cards?|google play|apple card|itunes|steam card|wire transfer|wire \$?\d+|send \$?\d+|crypto|usdt|bitcoin|zelle|venmo|cash ?app|ssn|social security number|bank(?:ing)? details|kyc|clave|contraseña|tarjeta|carte bancaire)\b/gi,
    weight: 26,
    reason: 'Requests sensitive credentials, OTP codes, or irreversible payment',
  },
  {
    category: 'secrecy',
    regex: /\b(do not tell|don't tell|keep (?:this )?(?:confidential|secret|between us)|do not hang up|stay on the line|move to (?:whatsapp|telegram)|message me on (?:whatsapp|telegram)|don't mention|no one else|or tell anyone|do not shut down)\b/gi,
    weight: 28,
    reason: 'Isolates target from family, bank staff, or verification channels',
  },
  {
    category: 'bait',
    regex: /\b(congratulations|you(?:'ve| have) won|unclaimed (?:refund|prize|inheritance)|guaranteed (?:profit|return|roi)|free (?:iphone|gift|airdrop)|double your|easy money|work from home.*\$\d{3,})\b/gi,
    weight: 20,
    reason: 'Uses unsolicited reward or guaranteed financial return bait',
  },
  {
    category: 'extraction',
    regex: /\b(anydesk|teamviewer|ultraviewer|quick assist|remote access|screen ?share|install (?:this|the) (?:app|apk|profile))\b/gi,
    weight: 42,
    reason: 'Requests remote device control software commonly abused in support scams',
  },
];

// Protective context phrases that legitimately appear in official 2FA & anti-fraud notices
const PROTECTIVE_CONTEXT_REGEX = /\b(never ask (?:you )?for|do not share (?:this|your) code|no action (?:is )?needed|if you recognize this|never call (?:you )?to ask|we will never ask|for your eyes only)\b/gi;

// Adaptive local memory helpers
export function loadAdaptiveMemory(): AdaptiveMemoryState {
  try {
    const raw = localStorage.getItem(ADAPTIVE_STORAGE_KEY);
    if (!raw) {
      return { scamExamplesCount: 0, safeExamplesCount: 0, tokenWeights: {}, lastUpdated: null };
    }
    const parsed = JSON.parse(raw) as AdaptiveMemoryState;
    return {
      scamExamplesCount: parsed.scamExamplesCount || 0,
      safeExamplesCount: parsed.safeExamplesCount || 0,
      tokenWeights: parsed.tokenWeights || {},
      lastUpdated: parsed.lastUpdated || null,
    };
  } catch {
    return { scamExamplesCount: 0, safeExamplesCount: 0, tokenWeights: {}, lastUpdated: null };
  }
}

export function teachAdaptiveModel(text: string, label: 'scam' | 'safe'): AdaptiveMemoryState {
  const state = loadAdaptiveMemory();
  const { cleaned } = deobfuscateText(text);
  const tokens = cleaned
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 4);

  const unique = Array.from(new Set(tokens));
  const delta = label === 'scam' ? 6.5 : -6.5;

  for (const tok of unique) {
    const prev = state.tokenWeights[tok] || 0;
    state.tokenWeights[tok] = Math.max(-28, Math.min(28, Number((prev + delta).toFixed(2))));
  }

  if (label === 'scam') state.scamExamplesCount += 1;
  else state.safeExamplesCount += 1;
  state.lastUpdated = Date.now();

  try {
    localStorage.setItem(ADAPTIVE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore quota errors in restricted sandboxes
  }
  return state;
}

export function resetAdaptiveMemory(): AdaptiveMemoryState {
  const empty: AdaptiveMemoryState = {
    scamExamplesCount: 0,
    safeExamplesCount: 0,
    tokenWeights: {},
    lastUpdated: null,
  };
  try {
    localStorage.removeItem(ADAPTIVE_STORAGE_KEY);
  } catch {
    // Ignore
  }
  return empty;
}

// 2-Layer Neural MLP classifier operating over normalized behavioral + semantic + structural features
function runNeuralRiskMlp(f: NeuralFeatureVector): number {
  // Hidden layer (6 specialized neurons capturing non-linear interactions)
  // Neuron 1: Classic Urgency + Extraction/URL threat
  const h1 = Math.max(
    0,
    0.9 * f.urgencySignal + 1.15 * f.extractionSignal + 0.95 * f.urlRiskSignal - 0.65 * f.protectiveContextDiscount - 0.28
  );
  // Neuron 2: Authority Impersonation + Isolation / Secrecy (catches unseen social engineering!)
  const h2 = Math.max(
    0,
    0.85 * f.impersonationSignal + 1.25 * f.secrecySignal + 0.6 * f.urgencySignal - 0.32
  );
  // Neuron 3: Semantic Neural Embedding Divergence (unseen phrasing & multilingual)
  const semDiff = Math.max(0, f.semanticScamSimilarity - f.semanticLegitSimilarity * 0.72);
  const h3 = Math.max(0, 1.85 * semDiff + 0.45 * f.impersonationSignal - 0.55 * f.protectiveContextDiscount - 0.14);
  // Neuron 4: Adversarial Obfuscation + Deception Link
  const h4 = Math.max(0, 1.3 * f.obfuscationSignal + 0.9 * f.urlRiskSignal - 0.12);
  // Neuron 5: Legitimate Protective / Informational Suppressor
  const h5 = Math.max(
    0,
    1.1 * f.protectiveContextDiscount + 0.9 * f.semanticLegitSimilarity - 0.8 * f.urlRiskSignal - 0.6 * f.secrecySignal - 0.22
  );
  // Neuron 6: Adaptive Local Memory Influence
  const h6 = f.adaptiveDelta;

  // Output logit -> calibrated sigmoid
  const logit = -2.25 + 2.65 * h1 + 2.85 * h2 + 2.35 * h3 + 2.75 * h4 - 2.15 * h5 + 1.6 * h6;
  const prob = 1 / (1 + Math.exp(-logit));
  return Math.round(Math.max(2, Math.min(99, prob * 100)));
}

function scoreToRiskLevel(score: number): RiskLevel {
  if (score >= 76) return 'critical';
  if (score >= 52) return 'high';
  if (score >= 28) return 'caution';
  return 'low';
}

export function analyzeCommunication(rawText: string, channel: ChannelType): AnalysisResult {
  const startPerf = performance.now();
  const trimmed = rawText.trim();

  if (!trimmed) {
    return {
      id: `scan_${Date.now()}`,
      timestamp: Date.now(),
      channel,
      originalText: '',
      deobfuscatedText: '',
      detectedLanguage: 'English',
      riskScore: 0,
      riskLevel: 'low',
      confidence: 100,
      primaryCategory: 'Awaiting input',
      summary: 'Enter or select a message, link, or call transcript to analyze locally.',
      guardianSummary: 'Paste a text message or link to check if it is safe.',
      processingTimeMs: 0,
      highlightedSpans: [],
      tactics: [],
      urlReports: [],
      explanations: [],
      recommendations: [],
      features: {
        semanticScamSimilarity: 0,
        semanticLegitSimilarity: 0,
        urgencySignal: 0,
        extractionSignal: 0,
        impersonationSignal: 0,
        secrecySignal: 0,
        urlRiskSignal: 0,
        obfuscationSignal: 0,
        protectiveContextDiscount: 0,
        adaptiveDelta: 0,
      },
      obfuscationDetected: false,
      adaptiveInfluence: 0,
    };
  }

  // 1. De-obfuscation & Homoglyph inspection
  const { cleaned, homoglyphCount, zeroWidthCount, leetspeakTokens } = deobfuscateText(trimmed);
  const obfuscationDetected = homoglyphCount > 0 || zeroWidthCount > 0 || leetspeakTokens.length > 0;
  const detectedLanguage = detectLanguage(cleaned);

  // 2. Semantic Subword N-gram Vector Similarity
  const textVec = embedSubwordVector(cleaned);
  const rawScamSim = Math.max(0, cosineSimilarity(textVec, SCAM_CENTROID));
  const rawLegitSim = Math.max(0, cosineSimilarity(textVec, LEGIT_CENTROID));

  // 3. URL Forensic Inspection
  const urlReports = extractAndAnalyzeUrls(trimmed, cleaned);
  const maxUrlScore = urlReports.reduce((acc, r) => Math.max(acc, r.riskScore), 0);

  // 4. Protective Anti-Scam Context Detection (prevents false positives on real 2FA notices)
  const protectiveMatches = Array.from(cleaned.matchAll(PROTECTIVE_CONTEXT_REGEX));
  const protectiveContextDiscount = Math.min(1, protectiveMatches.length * 0.55);

  // 5. Behavioral & Social Engineering Span Extraction
  const spans: HighlightedSpan[] = [];
  const categorySums: Record<HighlightedSpan['category'], number> = {
    urgency: 0,
    impersonation: 0,
    extraction: 0,
    secrecy: 0,
    bait: 0,
    url: maxUrlScore,
    obfuscation: 0,
  };

  for (const rule of SIGNAL_RULES) {
    const matches = Array.from(cleaned.matchAll(rule.regex));
    for (const m of matches) {
      if (m.index === undefined) continue;
      // If a real 2FA notice says "do not share this code" or "never ask for OTP", discount extraction false alarm
      const windowAround = cleaned.slice(Math.max(0, m.index - 35), Math.min(cleaned.length, m.index + m[0].length + 35));
      const isProtectiveMention =
        rule.category === 'extraction' &&
        /\b(never ask|do not share|don't share|never call|if you did not)\b/i.test(windowAround);

      if (isProtectiveMention) continue;

      spans.push({
        start: m.index,
        end: m.index + m[0].length,
        text: m[0],
        category: rule.category,
        reason: rule.reason,
        weight: rule.weight,
      });
      categorySums[rule.category] = Math.min(100, categorySums[rule.category] + rule.weight);
    }
  }

  // Add URL spans
  for (const report of urlReports) {
    const idx = trimmed.indexOf(report.rawUrl);
    if (idx !== -1 && report.riskScore >= 20) {
      spans.push({
        start: idx,
        end: idx + report.rawUrl.length,
        text: report.rawUrl,
        category: 'url',
        reason: report.flags[0] || 'Suspicious link structure',
        weight: report.riskScore,
      });
    }
  }

  // Obfuscation scoring
  const obfuscationScore = Math.min(
    100,
    homoglyphCount * 22 + zeroWidthCount * 15 + leetspeakTokens.length * 24
  );
  categorySums.obfuscation = obfuscationScore;

  // Remote access & imperative action cues (syntax-aware boost for unseen scams)
  const hasRemoteControl = /\b(anydesk|teamviewer|ultraviewer|quick assist|remote access|screen ?share)\b/i.test(cleaned);
  const hasImperativePaymentOrCode = /\b(send|wire|transfer|pay|enter|confirm|verify|click|tap|call|reply|download|install)\b/i.test(cleaned);

  // Additional unseen-scam contextual framing (e.g., new phone number excuse + money/help)
  const hasNewNumberExcuse = /\b(new number|friend'?s (?:phone|number)|lost my (?:phone|wallet)|broke my phone)\b/i.test(cleaned);
  if (hasNewNumberExcuse) {
    categorySums.impersonation = Math.min(100, categorySums.impersonation + 34);
  }
  if (hasImperativePaymentOrCode && urlReports.length > 0 && maxUrlScore >= 25) {
    categorySums.urgency = Math.min(100, categorySums.urgency + 14);
  }

  // 6. Adaptive On-Device Memory Influence
  const adaptive = loadAdaptiveMemory();
  const tokens = cleaned
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 4);

  let adaptiveSum = 0;
  for (const tok of Array.from(new Set(tokens))) {
    if (adaptive.tokenWeights[tok]) {
      adaptiveSum += adaptive.tokenWeights[tok];
    }
  }
  const adaptiveDelta = Math.max(-1, Math.min(1, adaptiveSum / 35));

  // 7. Build Normalized Feature Vector & Run 2-Layer Neural MLP
  const features: NeuralFeatureVector = {
    semanticScamSimilarity: Math.min(1, rawScamSim * 1.65),
    semanticLegitSimilarity: Math.min(1, rawLegitSim * 1.65),
    urgencySignal: categorySums.urgency / 100,
    extractionSignal: categorySums.extraction / 100,
    impersonationSignal: categorySums.impersonation / 100,
    secrecySignal: categorySums.secrecy / 100,
    urlRiskSignal: maxUrlScore / 100,
    obfuscationSignal: obfuscationScore / 100,
    protectiveContextDiscount,
    adaptiveDelta,
  };

  let riskScore = runNeuralRiskMlp(features);

  // Calibrate remote-access tech support scams cleanly
  if (hasRemoteControl && (categorySums.impersonation > 0 || categorySums.urgency > 0 || /\brefund\b/i.test(cleaned))) {
    riskScore = Math.max(riskScore, 84);
  }
  // Calibrate pure-URL channel scans cleanly
  if (channel === 'url' && urlReports.length > 0) {
    riskScore = Math.max(riskScore, urlReports[0].riskScore);
  }
  // Ensure benign messages without URLs or manipulation remain clearly low-risk
  if (
    maxUrlScore < 15 &&
    categorySums.urgency === 0 &&
    categorySums.extraction === 0 &&
    categorySums.secrecy === 0 &&
    obfuscationScore === 0 &&
    adaptiveDelta <= 0.1
  ) {
    riskScore = Math.min(riskScore, 22);
  }

  const riskLevel = scoreToRiskLevel(riskScore);

  // Deduplicate overlapping highlighted spans by keeping highest weight
  spans.sort((a, b) => a.start - b.start || b.weight - a.weight);
  const mergedSpans: HighlightedSpan[] = [];
  for (const sp of spans) {
    const last = mergedSpans[mergedSpans.length - 1];
    if (!last || sp.start >= last.end) {
      mergedSpans.push(sp);
    } else if (sp.weight > last.weight) {
      mergedSpans[mergedSpans.length - 1] = sp;
    }
  }

  // 8. Tactic Breakdown
  const tactics: TacticScore[] = [
    {
      id: 'urgency',
      label: 'Manufactured Urgency',
      score: Math.round(categorySums.urgency),
      description: 'Pressures rapid action before you can verify independently.',
    },
    {
      id: 'impersonation',
      label: 'Authority & Identity Framing',
      score: Math.round(categorySums.impersonation),
      description: 'Poses as a bank, government office, employer, or relative.',
    },
    {
      id: 'extraction',
      label: 'Credential / Payment Trap',
      score: Math.round(categorySums.extraction),
      description: 'Seeks OTP codes, passwords, gift cards, or irreversible transfers.',
    },
    {
      id: 'urlDeception',
      label: 'Link & Domain Spoofing',
      score: Math.round(maxUrlScore),
      description: 'Uses lookalike brands, high-risk TLDs, or hidden redirects.',
    },
    {
      id: 'secrecy',
      label: 'Secrecy & Isolation',
      score: Math.round(categorySums.secrecy),
      description: 'Discourages checking with family, banks, or official channels.',
    },
    {
      id: 'obfuscation',
      label: 'Adversarial Obfuscation',
      score: Math.round(obfuscationScore),
      description: 'Hides keywords using homoglyphs, zero-width chars, or leetspeak.',
    },
    {
      id: 'bait',
      label: 'Reward / Scarcity Bait',
      score: Math.round(categorySums.bait),
      description: 'Promises prizes, refunds, or guaranteed investment returns.',
    },
    {
      id: 'remoteControl',
      label: 'Remote Access Risk',
      score: hasRemoteControl ? 92 : 0,
      description: 'Requests screen-sharing or remote desktop installation.',
    },
  ];

  // 9. Determine Primary Category & Plain-Language Explanations
  const primaryCategory = deriveCategory(riskLevel, tactics, urlReports, hasNewNumberExcuse, detectedLanguage);
  const explanations = buildExplanations(
    riskLevel,
    features,
    urlReports,
    homoglyphCount,
    zeroWidthCount,
    leetspeakTokens,
    protectiveContextDiscount,
    detectedLanguage,
    adaptiveDelta
  );
  const recommendations = buildRecommendations(riskLevel, tactics, urlReports, hasNewNumberExcuse);

  const confidence = Math.min(
    99,
    Math.max(
      68,
      Math.round(70 + Math.abs(riskScore - 45) * 0.52 + (urlReports.length > 0 ? 6 : 0))
    )
  );

  const summary = buildSummary(riskLevel, primaryCategory, riskScore);
  const guardianSummary = buildGuardianSummary(riskLevel, primaryCategory, hasNewNumberExcuse, urlReports.length > 0);
  const processingTimeMs = Number(Math.max(0.4, performance.now() - startPerf).toFixed(1));

  return {
    id: `scan_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    channel,
    originalText: trimmed,
    deobfuscatedText: cleaned,
    detectedLanguage,
    riskScore,
    riskLevel,
    confidence,
    primaryCategory,
    summary,
    guardianSummary,
    processingTimeMs,
    highlightedSpans: mergedSpans,
    tactics,
    urlReports,
    explanations,
    recommendations,
    features,
    obfuscationDetected,
    adaptiveInfluence: Math.round(adaptiveDelta * 100),
  };
}

function deriveCategory(
  riskLevel: RiskLevel,
  tactics: TacticScore[],
  urlReports: UrlForensicReport[],
  hasNewNumberExcuse: boolean,
  lang: DetectedLanguage
): string {
  if (riskLevel === 'low') return 'Legitimate Communication';
  const top = [...tactics].sort((a, b) => b.score - a.score)[0];

  if (hasNewNumberExcuse) return 'Family / Emergency Impersonation';
  if (tactics.find((t) => t.id === 'remoteControl')?.score) return 'Tech Support Remote Access Scam';
  if (urlReports.some((u) => u.impersonatedBrand)) {
    const brand = urlReports.find((u) => u.impersonatedBrand)?.impersonatedBrand;
    return `Brand Phishing (${brand?.toUpperCase()})`;
  }
  if (top?.id === 'obfuscation' && top.score >= 30) return 'Obfuscated Evasion Phishing';
  if (top?.id === 'urlDeception' && top.score >= 35) return 'Malicious Link Phishing';
  if (top?.id === 'extraction' && top.score >= 35) return 'Credential / Financial Extraction';
  if (top?.id === 'secrecy' && top.score >= 30) return 'Social Engineering & Isolation';
  if (top?.id === 'bait' && top.score >= 30) return 'Financial / Prize Lure';
  if (lang !== 'English') return `Multilingual Fraud Pattern (${lang})`;
  return 'Suspicious Social Engineering';
}

function buildSummary(riskLevel: RiskLevel, category: string, score: number): string {
  if (riskLevel === 'low') {
    return `Local neural assessment cleared this message (${score}/100) with no deceptive links or coercive patterns.`;
  }
  if (riskLevel === 'caution') {
    return `Moderate warning signals detected (${score}/100) consistent with ${category.toLowerCase()}. Verify independently before acting.`;
  }
  if (riskLevel === 'high') {
    return `High-confidence scam indicators (${score}/100) matching ${category}. Do not click links, reply, or share codes.`;
  }
  return `Critical fraud pattern detected (${score}/100): ${category}. Multiple manipulation and deception signals triggered simultaneously.`;
}

function buildGuardianSummary(
  riskLevel: RiskLevel,
  category: string,
  hasNewNumberExcuse: boolean,
  hasUrl: boolean
): string {
  if (riskLevel === 'low') {
    return 'This message looks safe. Even so, never share bank passwords or one-time codes with anyone.';
  }
  if (hasNewNumberExcuse) {
    return 'STOP: Someone may be pretending to be a family member with a new phone number asking for money. Call your relative on their old saved number first.';
  }
  if (hasUrl) {
    return `WARNING: This looks like a fake message (${category}) trying to trick you into opening a dangerous link. Do NOT tap the link.`;
  }
  return `WARNING: This message uses pressure tactics typical of a scam (${category}). Do not send money, gift cards, or security codes.`;
}

function buildExplanations(
  riskLevel: RiskLevel,
  features: NeuralFeatureVector,
  urlReports: UrlForensicReport[],
  homoglyphCount: number,
  zeroWidthCount: number,
  leetspeakTokens: string[],
  protectiveDiscount: number,
  lang: DetectedLanguage,
  adaptiveDelta: number
): ExplanationPoint[] {
  const points: ExplanationPoint[] = [];

  if (homoglyphCount > 0 || zeroWidthCount > 0 || leetspeakTokens.length > 0) {
    const details: string[] = [];
    if (homoglyphCount > 0) details.push(`${homoglyphCount} non-Latin lookalike character(s)`);
    if (zeroWidthCount > 0) details.push(`${zeroWidthCount} invisible zero-width character(s)`);
    if (leetspeakTokens.length > 0) details.push(`character substitutions (${leetspeakTokens.slice(0, 3).join(', ')})`);
    points.push({
      title: 'Adversarial Text Obfuscation Detected',
      detail: `The sender disguised words using ${details.join(', ')} to evade basic keyword filters. Local normalization exposed the underlying intent.`,
      severity: 'danger',
    });
  }

  for (const url of urlReports) {
    if (url.riskScore >= 25) {
      points.push({
        title: `Deceptive Link Anatomy (${url.registrableDomain})`,
        detail: url.flags.join('; ') + '.',
        severity: url.riskScore >= 50 ? 'danger' : 'warning',
      });
    }
  }

  if (features.semanticScamSimilarity > features.semanticLegitSimilarity + 0.12 && riskLevel !== 'low') {
    points.push({
      title: `Semantic Intent Match (${lang})`,
      detail: 'Subword n-gram embeddings align closely with known fraud coercion structures even where phrasing varies from standard templates.',
      severity: riskLevel === 'critical' || riskLevel === 'high' ? 'danger' : 'warning',
    });
  }

  if (features.urgencySignal >= 0.2 && features.extractionSignal >= 0.2) {
    points.push({
      title: 'Coercive Pressure + Extraction Pairing',
      detail: 'Combines an urgent threat or deadline with a request for credentials, verification codes, or direct payment.',
      severity: 'danger',
    });
  }

  if (features.secrecySignal >= 0.2) {
    points.push({
      title: 'Victim Isolation Tactic',
      detail: 'Instructs the recipient not to tell anyone or to move to an encrypted chat app, a hallmark of impersonation and advance-fee scams.',
      severity: 'danger',
    });
  }

  if (protectiveDiscount > 0.3 && riskLevel === 'low') {
    points.push({
      title: 'Protective Security Language Verified',
      detail: 'Contains explicit anti-fraud guidance ("never ask for this code" / "no action needed") with no deceptive links.',
      severity: 'info',
    });
  }

  if (Math.abs(adaptiveDelta) >= 0.15) {
    points.push({
      title: 'On-Device Adaptive Memory Applied',
      detail:
        adaptiveDelta > 0
          ? 'Local user-trained weights reinforced this risk score based on previously flagged scam patterns.'
          : 'Local user-trained weights lowered this risk score based on previously trusted safe patterns.',
      severity: adaptiveDelta > 0 ? 'warning' : 'info',
    });
  }

  if (points.length === 0) {
    points.push({
      title: riskLevel === 'low' ? 'Normal Conversational Structure' : 'Elevated Linguistic Risk Signals',
      detail:
        riskLevel === 'low'
          ? 'No brand impersonation, artificial urgency, secrecy framing, or suspicious links were found locally.'
          : 'The combination of imperative phrasing and external requests raises caution.',
      severity: riskLevel === 'low' ? 'info' : 'warning',
    });
  }

  return points;
}

function buildRecommendations(
  riskLevel: RiskLevel,
  tactics: TacticScore[],
  urlReports: UrlForensicReport[],
  hasNewNumberExcuse: boolean
): ActionRecommendation[] {
  if (riskLevel === 'low') {
    return [
      {
        step: 1,
        action: 'Safe to read, stay vigilant',
        detail: 'No immediate threat markers found. Continue verifying unexpected financial requests through official channels.',
        priority: 'preventive',
      },
    ];
  }

  const recs: ActionRecommendation[] = [];
  let step = 1;

  if (urlReports.some((u) => u.riskScore >= 25)) {
    recs.push({
      step: step++,
      action: 'Do not tap or open the link',
      detail: 'Open a separate browser tab or your official bank/service app directly instead of using links inside messages.',
      priority: 'immediate',
    });
  }

  if (hasNewNumberExcuse) {
    recs.push({
      step: step++,
      action: 'Call the person on their saved number',
      detail: 'Never wire money based on a text from an "unknown" or "new" number. Verify their voice on your existing contact.',
      priority: 'immediate',
    });
  }

  if ((tactics.find((t) => t.id === 'extraction')?.score || 0) >= 20) {
    recs.push({
      step: step++,
      action: 'Never share OTPs, PINs, or gift cards',
      detail: 'Legitimate banks, tax agencies, and tech companies will never ask for 6-digit passcodes, gift cards, or cryptocurrency.',
      priority: 'immediate',
    });
  }

  if ((tactics.find((t) => t.id === 'remoteControl')?.score || 0) >= 50) {
    recs.push({
      step: step++,
      action: 'Refuse remote screen-sharing apps',
      detail: 'Do not install AnyDesk, TeamViewer, or Quick Assist for an unsolicited caller. Close your device or disconnect Wi-Fi if already installed.',
      priority: 'immediate',
    });
  }

  recs.push({
    step: step++,
    action: 'Verify via the number on your card or statement',
    detail: 'If unsure, call the official customer service number printed on the back of your bank card or official bill.',
    priority: 'verify',
  });

  recs.push({
    step: step++,
    action: 'Block sender and consult a trusted contact',
    detail: 'Block the number on your device. If you already clicked a link or shared info, contact your bank fraud line immediately.',
    priority: 'preventive',
  });

  return recs;
}

export function analyzeVoiceCallTurns(turns: VoiceTurn[]): VoiceTurnAssessment[] {
  const assessments: VoiceTurnAssessment[] = [];
  let runningText = '';

  for (const turn of turns) {
    runningText = runningText ? `${runningText}\n${turn.text}` : turn.text;
    const callerOnlyText = turns
      .slice(0, turns.indexOf(turn) + 1)
      .filter((t) => t.speaker === 'caller')
      .map((t) => t.text)
      .join(' ');

    const analysis = analyzeCommunication(callerOnlyText || runningText, 'voice');
    const turnAnalysis = analyzeCommunication(turn.text, 'voice');

    const turnFlags: string[] = [];
    for (const sp of turnAnalysis.highlightedSpans) {
      if (!turnFlags.includes(sp.reason)) {
        turnFlags.push(sp.reason);
      }
    }

    let escalationReason: string | null = null;
    if (turn.speaker === 'caller' && turnAnalysis.riskScore >= 55) {
      escalationReason = turnAnalysis.primaryCategory;
    } else if (analysis.riskScore >= 70 && assessments[assessments.length - 1]?.cumulativeRiskScore < 70) {
      escalationReason = 'Cumulative social engineering threshold crossed';
    }

    assessments.push({
      turnId: turn.id,
      cumulativeRiskScore: analysis.riskScore,
      riskLevel: analysis.riskLevel,
      turnFlags: turnFlags.slice(0, 3),
      escalationReason,
    });
  }

  return assessments;
}
