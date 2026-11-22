import React from 'react';
import { Cpu, Database, Lock, RefreshCw, Shield, WifiOff } from 'lucide-react';
import { AdaptiveMemoryState, LocalAuditEntry } from '../engine/types';

interface ArchitectureViewProps {
  auditLog: LocalAuditEntry[];
  adaptiveMemory: AdaptiveMemoryState;
  onResetAdaptive: () => void;
}

export const ArchitectureView: React.FC<ArchitectureViewProps> = ({
  auditLog,
  adaptiveMemory,
  onResetAdaptive,
}) => {
  const learnedEntries = Object.entries(adaptiveMemory.tokenWeights)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 12);

  return (
    <div className="mx-auto max-w-[1360px] px-6 py-8 space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
          On-Device AI Architecture &amp; Zero-Egress Privacy Model
        </h1>
        <p className="mt-1 text-sm text-slate-600 max-w-3xl">
          Aegis Local processes sensitive SMS, links, and call transcripts strictly inside local browser memory. No message text, phone numbers, or behavioral flags ever leave the device.
        </p>
      </div>

      {/* 4-Stage Pipeline Explanation */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
            <Shield className="h-4 w-4 text-blue-700" />
            01. Unicode De-obfuscation
          </div>
          <p className="mt-2 text-xs text-slate-600 leading-relaxed">
            Strips invisible zero-width characters, maps Cyrillic and Greek homoglyphs back to Latin characters, and resolves leetspeak evasions before inference.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
            <Cpu className="h-4 w-4 text-blue-700" />
            02. 64-d Subword Embeddings
          </div>
          <p className="mt-2 text-xs text-slate-600 leading-relaxed">
            Projects character 3-grams, 4-grams, and word skip-grams into a 64-dimensional semantic vector to detect unseen phrasing and multilingual scams without rigid keyword lists.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
            <Lock className="h-4 w-4 text-blue-700" />
            03. URL &amp; Brand Forensics
          </div>
          <p className="mt-2 text-xs text-slate-600 leading-relaxed">
            Decomposes links offline to catch punycode, subdomain brand traps, IP hosts, shorteners, high-abuse TLDs, and Levenshtein typosquatting against 40+ trusted institutions.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
            <WifiOff className="h-4 w-4 text-blue-700" />
            04. Neural MLP &amp; Local Memory
          </div>
          <p className="mt-2 text-xs text-slate-600 leading-relaxed">
            Combines behavioral signals, protective-context suppression, and a 2-layer neural classifier with on-device adaptive weights persisted locally in browser storage.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Zero-Egress Local Audit Log */}
        <section className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Local Processing &amp; Zero-Egress Audit Log
              </h2>
              <p className="text-xs text-slate-500">
                Verifies every analysis occurred in local memory with zero external API payload transmission.
              </p>
            </div>
            <span className="font-mono text-xs font-semibold text-emerald-700 tabular-nums">
              External Egress: 0 B
            </span>
          </div>

          {auditLog.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500">
              No logged scans yet. Use the Scanner and click &ldquo;Log Local Scan&rdquo; to record an on-device audit entry.
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                    <th className="py-2 pr-3">Time</th>
                    <th className="py-2 pr-3">Channel</th>
                    <th className="py-2 pr-3">Excerpt (Local Only)</th>
                    <th className="py-2 pr-3 text-right">Risk</th>
                    <th className="py-2 pr-3 text-right">Latency</th>
                    <th className="py-2 text-right">Sent Externally</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditLog.map((entry) => (
                    <tr key={entry.id}>
                      <td className="py-2.5 pr-3 font-mono text-[11px] text-slate-500 whitespace-nowrap tabular-nums">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-2.5 pr-3 uppercase font-mono text-[11px] text-slate-700">
                        {entry.channel}
                      </td>
                      <td className="py-2.5 pr-3 text-slate-800 max-w-[220px] truncate">
                        {entry.preview}
                      </td>
                      <td className="py-2.5 pr-3 text-right font-mono font-semibold tabular-nums">
                        {entry.riskScore}/100
                      </td>
                      <td className="py-2.5 pr-3 text-right font-mono text-slate-600 tabular-nums">
                        {entry.processingTimeMs} ms
                      </td>
                      <td className="py-2.5 text-right font-mono text-emerald-700 tabular-nums">
                        {entry.bytesTransmittedExternally} B
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Adaptive Weight Inspector & Vulnerable Population Impact */}
        <section className="lg:col-span-5 space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-slate-700" />
                <h2 className="text-sm font-semibold text-slate-900">
                  Adaptive On-Device Memory
                </h2>
              </div>
              <button
                type="button"
                onClick={onResetAdaptive}
                disabled={adaptiveMemory.scamExamplesCount + adaptiveMemory.safeExamplesCount === 0}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 whitespace-nowrap"
              >
                <RefreshCw className="h-3 w-3" />
                Reset Weights
              </button>
            </div>

            <div className="mt-3 flex items-center gap-4 text-xs text-slate-600 tabular-nums">
              <span>Scam samples learned: {adaptiveMemory.scamExamplesCount}</span>
              <span aria-hidden="true">·</span>
              <span>Safe samples learned: {adaptiveMemory.safeExamplesCount}</span>
            </div>

            {learnedEntries.length === 0 ? (
              <p className="mt-4 text-xs text-slate-500">
                No custom adaptive weights stored yet. Use &ldquo;Teach: This is a Scam&rdquo; or &ldquo;Teach: Mark as Safe&rdquo; in the Scanner to adapt the model locally.
              </p>
            ) : (
              <div className="mt-4 space-y-1.5">
                {learnedEntries.map(([token, weight]) => (
                  <div
                    key={token}
                    className="flex items-center justify-between text-xs py-1 border-b border-slate-100 last:border-0"
                  >
                    <span className="font-mono text-slate-800">{token}</span>
                    <span
                      className={`font-mono font-semibold tabular-nums ${
                        weight > 0 ? 'text-red-700' : 'text-emerald-700'
                      }`}
                    >
                      {weight > 0 ? `+${weight}` : weight}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-sm font-semibold text-slate-900">
              Protection for Elderly &amp; Vulnerable Users
            </h2>
            <ul className="mt-3 space-y-2 text-xs text-slate-600 leading-relaxed list-disc list-inside">
              <li>
                <strong>Senior Guardian Mode:</strong> Replaces technical scoring jargon with large, high-contrast plain-language guidance and one-tap local Web Speech audio read-aloud.
              </li>
              <li>
                <strong>Protective Context Awareness:</strong> Distinguishes real bank 2FA warnings (&ldquo;never share this code&rdquo;) from active OTP theft attempts so users are not fatigued by false alarms.
              </li>
              <li>
                <strong>Offline Resilience:</strong> Cached Service Worker assets and in-memory weights ensure full protection even in low-connectivity or airplane-mode environments.
              </li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
};
