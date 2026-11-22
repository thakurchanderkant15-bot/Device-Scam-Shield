import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Link2,
  MessageSquare,
  Mail,
  ShieldAlert,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  Volume2,
  VolumeX,
  Eraser,
} from 'lucide-react';
import {
  AdaptiveMemoryState,
  AnalysisResult,
  ChannelType,
  HighlightedSpan,
  RiskLevel,
} from '../engine/types';
import { SAMPLE_CASES } from '../data/sampleCases';

interface AnalyzerViewProps {
  channel: ChannelType;
  onChannelChange: (ch: ChannelType) => void;
  inputText: string;
  onInputChange: (val: string) => void;
  result: AnalysisResult;
  guardianMode: boolean;
  adaptiveMemory: AdaptiveMemoryState;
  onTeachModel: (label: 'scam' | 'safe') => void;
  onRecordScan: () => void;
}

const QUICK_SAMPLE_IDS = [
  'legit-bank-alert',
  'legit-2fa-warning',
  'scam-usps-delivery',
  'unseen-homoglyph-url',
  'unseen-grandparent-emergency',
  'multi-hinglish-kyc',
];

function getRiskVisuals(level: RiskLevel) {
  switch (level) {
    case 'critical':
      return {
        label: 'Critical Scam Threat',
        textColor: 'text-red-800',
        bgTint: 'bg-red-50',
        borderTint: 'border-red-200',
        barColor: 'bg-red-600',
        Icon: ShieldAlert,
      };
    case 'high':
      return {
        label: 'High Fraud Risk',
        textColor: 'text-red-700',
        bgTint: 'bg-red-50',
        borderTint: 'border-red-200',
        barColor: 'bg-red-600',
        Icon: ShieldAlert,
      };
    case 'caution':
      return {
        label: 'Suspicious / Caution',
        textColor: 'text-amber-800',
        bgTint: 'bg-amber-50',
        borderTint: 'border-amber-200',
        barColor: 'bg-amber-600',
        Icon: AlertTriangle,
      };
    default:
      return {
        label: 'Low Risk / Safe',
        textColor: 'text-emerald-800',
        bgTint: 'bg-emerald-50',
        borderTint: 'border-emerald-200',
        barColor: 'bg-emerald-600',
        Icon: ShieldCheck,
      };
  }
}

function getSpanClass(category: HighlightedSpan['category']): string {
  switch (category) {
    case 'url':
    case 'obfuscation':
    case 'extraction':
    case 'secrecy':
      return 'bg-red-100 text-red-950 underline decoration-red-500 decoration-2 underline-offset-2 px-0.5 rounded-sm';
    default:
      return 'bg-amber-100 text-amber-950 underline decoration-amber-500 decoration-2 underline-offset-2 px-0.5 rounded-sm';
  }
}

export const AnalyzerView: React.FC<AnalyzerViewProps> = ({
  channel,
  onChannelChange,
  inputText,
  onInputChange,
  result,
  guardianMode,
  adaptiveMemory,
  onTeachModel,
  onRecordScan,
}) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  const quickSamples = SAMPLE_CASES.filter((c) => QUICK_SAMPLE_IDS.includes(c.id));
  const visuals = getRiskVisuals(result.riskLevel);
  const RiskIcon = visuals.Icon;

  const handleReadAloud = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    window.speechSynthesis.cancel();
    const spokenText = `${visuals.label}. Risk score ${result.riskScore} out of 100. ${
      guardianMode ? result.guardianSummary : result.summary
    } ${
      result.recommendations[0]
        ? `Recommended action: ${result.recommendations[0].action}. ${result.recommendations[0].detail}`
        : ''
    }`;
    const utterance = new SpeechSynthesisUtterance(spokenText);
    utterance.rate = guardianMode ? 0.9 : 1.0;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleTeach = (label: 'scam' | 'safe') => {
    onTeachModel(label);
    setFeedbackNotice(
      label === 'scam'
        ? 'Learned locally as a scam pattern. Future similar wording will score higher.'
        : 'Learned locally as a safe pattern. Future similar wording will score lower.'
    );
    setTimeout(() => setFeedbackNotice(null), 4500);
  };

  const renderHighlightedMessage = () => {
    const text = result.deobfuscatedText || result.originalText;
    if (!text) return null;
    if (result.highlightedSpans.length === 0) {
      return <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{text}</p>;
    }

    const parts: React.ReactNode[] = [];
    let cursor = 0;

    result.highlightedSpans.forEach((span, idx) => {
      const safeStart = Math.max(cursor, Math.min(span.start, text.length));
      const safeEnd = Math.max(safeStart, Math.min(span.end, text.length));

      if (safeStart > cursor) {
        parts.push(<span key={`plain-${idx}`}>{text.slice(cursor, safeStart)}</span>);
      }
      if (safeEnd > safeStart) {
        parts.push(
          <mark
            key={`span-${idx}`}
            title={span.reason}
            className={getSpanClass(span.category)}
          >
            {text.slice(safeStart, safeEnd)}
          </mark>
        );
      }
      cursor = safeEnd;
    });

    if (cursor < text.length) {
      parts.push(<span key="plain-tail">{text.slice(cursor)}</span>);
    }

    return (
      <p
        className={`whitespace-pre-wrap leading-relaxed text-slate-800 ${
          guardianMode ? 'text-base' : 'text-sm'
        }`}
      >
        {parts}
      </p>
    );
  };

  const activeTactics = result.tactics.filter((t) => t.score > 0);

  return (
    <div className="mx-auto max-w-[1360px] px-6 py-8">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 text-balance">
            Real-Time On-Device Message &amp; Link Shield
          </h1>
          <p className="mt-1 text-sm text-slate-600 max-w-2xl">
            Every character is analyzed locally in browser memory using subword semantic embeddings, URL structural forensics, and neural classification.
          </p>
        </div>
        <div className="text-xs text-slate-500 tabular-nums">
          <span>Language: {result.detectedLanguage}</span>
          <span aria-hidden="true"> · </span>
          <span>Latency: {result.processingTimeMs} ms</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        {/* Left Column: Input Composer & Local Adaptive Feedback */}
        <section
          aria-label="Communication Input"
          className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-6"
        >
          <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-100">
            <span className="text-sm font-semibold text-slate-900">Channel Input</span>
            <div className="inline-flex items-center rounded-lg bg-slate-100 p-1">
              {(
                [
                  { id: 'sms', label: 'SMS / Chat', Icon: MessageSquare },
                  { id: 'url', label: 'URL', Icon: Link2 },
                  { id: 'email', label: 'Email', Icon: Mail },
                ] as const
              ).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onChannelChange(id)}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    channel === id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <label htmlFor="scam-input-box" className="sr-only">
              Paste suspicious SMS, chat message, email, or web link
            </label>
            <textarea
              id="scam-input-box"
              rows={guardianMode ? 7 : 6}
              value={inputText}
              onChange={(e) => onInputChange(e.target.value)}
              placeholder={
                channel === 'url'
                  ? 'Paste a suspicious web link (e.g. https://pаypаl.com/auth or http://chase.verify-login.xyz)...'
                  : 'Paste an SMS, WhatsApp message, or email notice to inspect locally without internet access...'
              }
              className={`w-full rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 ${
                guardianMode ? 'text-base leading-relaxed' : 'text-sm leading-relaxed'
              }`}
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-slate-500 tabular-nums">
                {inputText.length} characters · Local memory only
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onInputChange('')}
                  disabled={!inputText}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 whitespace-nowrap shrink-0"
                >
                  <Eraser className="h-3.5 w-3.5" />
                  Clear
                </button>
                <button
                  type="button"
                  onClick={onRecordScan}
                  disabled={!inputText.trim()}
                  className="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-40 whitespace-nowrap shrink-0"
                >
                  Log Local Scan
                </button>
              </div>
            </div>
          </div>

          {/* Quick-Load Demonstration Samples */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-slate-800">Load Quick Demonstration</h2>
              <span className="text-xs text-slate-500">Legitimate vs. Scam vs. Unseen</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {quickSamples.map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => {
                    onChannelChange(sample.channel);
                    onInputChange(sample.content);
                  }}
                  className="text-left rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 transition-colors hover:border-slate-300 hover:bg-slate-100/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  <div className="text-xs font-semibold text-slate-900 truncate">
                    {sample.title}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500 truncate">
                    {sample.expectedLabel === 'safe' ? 'Legitimate' : 'Fraudulent'} · {sample.language}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* On-Device Adaptive Learning Control */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-slate-800">On-Device Adaptive Learning</h2>
              <span className="text-[11px] font-mono text-slate-500 tabular-nums">
                {adaptiveMemory.scamExamplesCount + adaptiveMemory.safeExamplesCount} learned samples
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-600">
              Train the local classifier on novel scam wording or correct a false positive. Updates remain strictly on this device.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!inputText.trim()}
                onClick={() => handleTeach('scam')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-800 hover:bg-red-100 disabled:opacity-40 whitespace-nowrap shrink-0"
              >
                <ThumbsDown className="h-3.5 w-3.5" />
                Teach: This is a Scam
              </button>
              <button
                type="button"
                disabled={!inputText.trim()}
                onClick={() => handleTeach('safe')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-40 whitespace-nowrap shrink-0"
              >
                <ThumbsUp className="h-3.5 w-3.5" />
                Teach: Mark as Safe
              </button>
            </div>
            {feedbackNotice && (
              <p className="mt-2 text-xs font-medium text-blue-800">{feedbackNotice}</p>
            )}
          </div>
        </section>

        {/* Right Column: Risk Verdict, Evidence Highlights, URL Forensics & Action Steps */}
        <section
          aria-label="Risk Assessment Output"
          className="lg:col-span-7 space-y-6"
        >
          {/* Verdict Summary Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className={`rounded-lg border p-2.5 ${visuals.bgTint} ${visuals.borderTint}`}>
                  <RiskIcon className={`h-6 w-6 ${visuals.textColor}`} />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`font-display text-lg font-bold ${visuals.textColor}`}>
                      {visuals.label}
                    </span>
                    <span className="text-xs text-slate-400" aria-hidden="true">·</span>
                    <span className="text-sm font-medium text-slate-700">
                      {result.primaryCategory}
                    </span>
                  </div>
                  <p className={`mt-1 text-slate-600 ${guardianMode ? 'text-base font-medium text-slate-900' : 'text-sm'}`}>
                    {guardianMode ? result.guardianSummary : result.summary}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={handleReadAloud}
                  disabled={!result.originalText}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 whitespace-nowrap shrink-0"
                >
                  {isSpeaking ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                  {isSpeaking ? 'Stop Audio' : 'Read Aloud'}
                </button>
              </div>
            </div>

            {/* Calibrated Score Bar */}
            <div className="mt-5 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-medium text-slate-700">Threat Risk Index</span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {result.riskScore} / 100 · {result.confidence}% confidence
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full transition-all duration-300 ${visuals.barColor}`}
                  style={{ width: `${Math.max(2, result.riskScore)}%` }}
                />
              </div>
            </div>

            {/* Actionable Recommendations immediately visible */}
            {result.recommendations.length > 0 && (
              <div className="mt-5 pt-4 border-t border-slate-100">
                <h2 className="text-xs font-semibold text-slate-900 mb-3">
                  Recommended User Protection Steps
                </h2>
                <div className="space-y-2.5">
                  {result.recommendations.map((rec) => (
                    <div key={rec.step} className="flex items-start gap-3">
                      <span
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums ${
                          rec.priority === 'immediate'
                            ? 'bg-red-100 text-red-800'
                            : rec.priority === 'verify'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {rec.step}
                      </span>
                      <div>
                        <div className={`font-semibold text-slate-900 ${guardianMode ? 'text-base' : 'text-sm'}`}>
                          {rec.action}
                        </div>
                        <p className={`text-slate-600 ${guardianMode ? 'text-sm' : 'text-xs'}`}>
                          {rec.detail}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Highlighted Evidence & Explanation */}
          {result.originalText && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <h2 className="text-sm font-semibold text-slate-900">
                    Evidence Attribution in Message
                  </h2>
                  <span className="text-xs text-slate-500 tabular-nums">
                    {result.highlightedSpans.length} flagged span(s)
                  </span>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
                  {renderHighlightedMessage()}
                </div>

                {result.obfuscationDetected && (
                  <div className="mt-3 rounded-lg border border-red-200 bg-red-50/70 p-3 text-xs text-red-900">
                    <span className="font-semibold">De-obfuscated Normalizer Output: </span>
                    <span className="font-mono break-all">{result.deobfuscatedText}</span>
                  </div>
                )}
              </div>

              {/* Plain-English Reasons */}
              <div className="pt-4 border-t border-slate-100">
                <h3 className="text-sm font-semibold text-slate-900 mb-3">
                  Why the Local AI Scored This Way
                </h3>
                <div className="space-y-3">
                  {result.explanations.map((exp, idx) => (
                    <div key={idx} className="flex items-start gap-2.5">
                      {exp.severity === 'danger' ? (
                        <ShieldAlert className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                      ) : exp.severity === 'warning' ? (
                        <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                      )}
                      <div>
                        <div className="text-xs font-semibold text-slate-900">{exp.title}</div>
                        <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{exp.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Social Engineering Tactic Breakdown */}
              {activeTactics.length > 0 && (
                <div className="pt-4 border-t border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">
                    Detected Social Engineering Vectors
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                    {activeTactics.map((tactic) => (
                      <div key={tactic.id}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-medium text-slate-800">{tactic.label}</span>
                          <span className="font-mono text-slate-700 tabular-nums">{tactic.score}%</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full ${
                              tactic.score >= 55 ? 'bg-red-600' : 'bg-amber-500'
                            }`}
                            style={{ width: `${tactic.score}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* URL Structural Forensics */}
              {result.urlReports.length > 0 && (
                <div className="pt-4 border-t border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">
                    URL Structural Forensics
                  </h3>
                  <div className="space-y-3">
                    {result.urlReports.map((urlReport, idx) => (
                      <div
                        key={idx}
                        className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 text-xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-mono font-semibold text-slate-900 break-all">
                            {urlReport.rawUrl}
                          </span>
                          <span
                            className={`font-mono font-semibold tabular-nums ${
                              urlReport.riskScore >= 50
                                ? 'text-red-700'
                                : urlReport.riskScore >= 25
                                ? 'text-amber-700'
                                : 'text-emerald-700'
                            }`}
                          >
                            Link Risk: {urlReport.riskScore}/100
                          </span>
                        </div>
                        <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-600">
                          <div>
                            <span className="text-slate-400 block">Protocol</span>
                            <span className="font-mono text-slate-800">{urlReport.protocol}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Subdomain</span>
                            <span className="font-mono text-slate-800 truncate block">
                              {urlReport.subdomain || '—'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Actual Domain</span>
                            <span className="font-mono font-semibold text-slate-900">
                              {urlReport.registrableDomain}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Target Brand</span>
                            <span className="font-mono text-slate-800">
                              {urlReport.impersonatedBrand || 'None detected'}
                            </span>
                          </div>
                        </div>
                        <ul className="mt-2.5 space-y-1 text-slate-700 list-disc list-inside">
                          {urlReport.flags.map((flag, fIdx) => (
                            <li key={fIdx}>{flag}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
