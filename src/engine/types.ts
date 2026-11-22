export type ChannelType = 'sms' | 'url' | 'email' | 'voice';

export type RiskLevel = 'low' | 'caution' | 'high' | 'critical';

export type DetectedLanguage = 'English' | 'Spanish' | 'Hindi / Hinglish' | 'French' | 'German' | 'Multilingual';

export interface HighlightedSpan {
  start: number;
  end: number;
  text: string;
  category:
    | 'urgency'
    | 'impersonation'
    | 'extraction'
    | 'secrecy'
    | 'bait'
    | 'url'
    | 'obfuscation';
  reason: string;
  weight: number;
}

export interface UrlForensicReport {
  rawUrl: string;
  normalizedUrl: string;
  protocol: string;
  subdomain: string;
  registrableDomain: string;
  tld: string;
  path: string;
  impersonatedBrand: string | null;
  riskScore: number;
  flags: string[];
}

export interface TacticScore {
  id:
    | 'urgency'
    | 'impersonation'
    | 'extraction'
    | 'secrecy'
    | 'bait'
    | 'urlDeception'
    | 'obfuscation'
    | 'remoteControl';
  label: string;
  score: number; // 0-100
  description: string;
}

export interface ExplanationPoint {
  title: string;
  detail: string;
  severity: 'info' | 'warning' | 'danger';
}

export interface ActionRecommendation {
  step: number;
  action: string;
  detail: string;
  priority: 'immediate' | 'verify' | 'preventive';
}

export interface NeuralFeatureVector {
  semanticScamSimilarity: number;
  semanticLegitSimilarity: number;
  urgencySignal: number;
  extractionSignal: number;
  impersonationSignal: number;
  secrecySignal: number;
  urlRiskSignal: number;
  obfuscationSignal: number;
  protectiveContextDiscount: number;
  adaptiveDelta: number;
}

export interface AnalysisResult {
  id: string;
  timestamp: number;
  channel: ChannelType;
  originalText: string;
  deobfuscatedText: string;
  detectedLanguage: DetectedLanguage;
  riskScore: number; // 0-100
  riskLevel: RiskLevel;
  confidence: number; // 0-100
  primaryCategory: string;
  summary: string;
  guardianSummary: string; // Plain-language summary for elderly / vulnerable users
  processingTimeMs: number;
  highlightedSpans: HighlightedSpan[];
  tactics: TacticScore[];
  urlReports: UrlForensicReport[];
  explanations: ExplanationPoint[];
  recommendations: ActionRecommendation[];
  features: NeuralFeatureVector;
  obfuscationDetected: boolean;
  adaptiveInfluence: number;
}

export interface VoiceTurn {
  id: string;
  speaker: 'caller' | 'recipient';
  text: string;
  timestampSec: number;
}

export interface VoiceTurnAssessment {
  turnId: string;
  cumulativeRiskScore: number;
  riskLevel: RiskLevel;
  turnFlags: string[];
  escalationReason: string | null;
}

export interface SampleCase {
  id: string;
  title: string;
  channel: ChannelType;
  category: 'legitimate' | 'known_scam' | 'unseen_obfuscated' | 'multilingual';
  expectedLabel: 'safe' | 'scam';
  language: DetectedLanguage;
  senderLabel: string;
  content: string;
  contextNote: string;
}

export interface LocalAuditEntry {
  id: string;
  timestamp: number;
  channel: ChannelType;
  preview: string;
  riskScore: number;
  riskLevel: RiskLevel;
  processingTimeMs: number;
  bytesTransmittedExternally: 0;
}

export interface AdaptiveMemoryState {
  scamExamplesCount: number;
  safeExamplesCount: number;
  tokenWeights: Record<string, number>;
  lastUpdated: number | null;
}
