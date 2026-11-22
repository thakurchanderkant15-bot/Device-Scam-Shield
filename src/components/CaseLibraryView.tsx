import React, { useMemo, useState } from 'react';
import { ArrowRight, Play, Search, ShieldAlert, ShieldCheck } from 'lucide-react';
import { analyzeCommunication } from '../engine/scamModel';
import { AnalysisResult, ChannelType, SampleCase } from '../engine/types';
import { SAMPLE_CASES } from '../data/sampleCases';

interface CaseLibraryViewProps {
  onLoadInAnalyzer: (text: string, channel: ChannelType) => void;
}

type FilterCategory = 'all' | SampleCase['category'];

interface BenchmarkRow {
  sample: SampleCase;
  result: AnalysisResult;
  passed: boolean;
}

export const CaseLibraryView: React.FC<CaseLibraryViewProps> = ({ onLoadInAnalyzer }) => {
  const [filter, setFilter] = useState<FilterCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [lastBenchmarkTime, setLastBenchmarkTime] = useState<number>(Date.now());

  const rows: BenchmarkRow[] = useMemo(() => {
    void lastBenchmarkTime;
    return SAMPLE_CASES.map((sample) => {
      const result = analyzeCommunication(sample.content, sample.channel);
      const predictedScam = result.riskScore >= 45;
      const expectedScam = sample.expectedLabel === 'scam';
      return {
        sample,
        result,
        passed: predictedScam === expectedScam,
      };
    });
  }, [lastBenchmarkTime]);

  const metrics = useMemo(() => {
    const total = rows.length;
    const passed = rows.filter((r) => r.passed).length;
    const legitRows = rows.filter((r) => r.sample.expectedLabel === 'safe');
    const falsePositives = legitRows.filter((r) => !r.passed).length;
    const scamRows = rows.filter((r) => r.sample.expectedLabel === 'scam');
    const detectedScams = scamRows.filter((r) => r.passed).length;
    const totalMs = rows.reduce((acc, r) => acc + r.result.processingTimeMs, 0);

    return {
      accuracy: Math.round((passed / total) * 100),
      scamRecall: Math.round((detectedScams / scamRows.length) * 100),
      falsePositiveRate: Math.round((falsePositives / legitRows.length) * 100),
      totalMs: Number(totalMs.toFixed(1)),
      total,
      passed,
    };
  }, [rows]);

  const filteredRows = rows.filter(({ sample }) => {
    const matchesCategory = filter === 'all' || sample.category === filter;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      sample.title.toLowerCase().includes(q) ||
      sample.content.toLowerCase().includes(q) ||
      sample.language.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="mx-auto max-w-[1360px] px-6 py-8 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            Legitimate vs. Fraudulent Benchmark Suite
          </h1>
          <p className="mt-1 text-sm text-slate-600 max-w-2xl">
            Live local evaluation across legitimate alerts, classic scams, unseen obfuscated attacks, and multilingual phishing. Every row is computed on-device.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setLastBenchmarkTime(Date.now())}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 whitespace-nowrap shrink-0"
        >
          <Play className="h-3.5 w-3.5" />
          Re-Run Local Benchmark
        </button>
      </div>

      {/* Benchmark KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Overall Classification Accuracy</div>
          <div className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
            {metrics.accuracy}%{' '}
            <span className="text-xs font-normal text-slate-500">
              ({metrics.passed}/{metrics.total})
            </span>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Scam &amp; Unseen Recall</div>
          <div className="mt-1 font-display text-2xl font-bold text-emerald-700 tabular-nums">
            {metrics.scamRecall}%
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Legitimate False-Positive Rate</div>
          <div className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
            {metrics.falsePositiveRate}%
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Total Local Inference Time</div>
          <div className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
            {metrics.totalMs} ms
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
          {(
            [
              { id: 'all', label: 'All Cases' },
              { id: 'legitimate', label: 'Legitimate' },
              { id: 'known_scam', label: 'Known Scams' },
              { id: 'unseen_obfuscated', label: 'Unseen & Obfuscated' },
              { id: 'multilingual', label: 'Multilingual' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                filter === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by wording or language..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
          />
        </div>
      </div>

      {/* Tabular Evaluation Grid */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-600">
                <th className="py-3 px-4">Scenario &amp; Context</th>
                <th className="py-3 px-4">Language / Channel</th>
                <th className="py-3 px-4 text-right">Local Score</th>
                <th className="py-3 px-4">Model Verdict</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500">
                    No sample cases match your filter. Clear search to view all {SAMPLE_CASES.length} scenarios.
                  </td>
                </tr>
              ) : (
                filteredRows.map(({ sample, result, passed }) => (
                  <tr key={sample.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 max-w-md">
                      <div className="font-semibold text-slate-900">{sample.title}</div>
                      <p className="mt-0.5 text-slate-600 line-clamp-2">{sample.content}</p>
                      <p className="mt-1 text-[11px] text-slate-500">{sample.contextNote}</p>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-600">
                      <div>{sample.language}</div>
                      <div className="text-[11px] text-slate-400">
                        {sample.channel.toUpperCase()} · {sample.expectedLabel === 'safe' ? 'Expected Safe' : 'Expected Scam'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-semibold tabular-nums whitespace-nowrap">
                      <span
                        className={
                          result.riskScore >= 52
                            ? 'text-red-700'
                            : result.riskScore >= 28
                            ? 'text-amber-700'
                            : 'text-emerald-700'
                        }
                      >
                        {result.riskScore}/100
                      </span>
                      <div className="text-[11px] font-normal text-slate-400">
                        {result.processingTimeMs} ms
                      </div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5 font-medium">
                        {result.riskScore >= 45 ? (
                          <ShieldAlert className="h-4 w-4 text-red-600" />
                        ) : (
                          <ShieldCheck className="h-4 w-4 text-emerald-600" />
                        )}
                        <span className={result.riskScore >= 45 ? 'text-red-800' : 'text-emerald-800'}>
                          {result.primaryCategory}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        {passed ? 'Matched ground truth' : 'Needs adaptive feedback'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onLoadInAnalyzer(sample.content, sample.channel)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100 whitespace-nowrap shrink-0"
                      >
                        Inspect
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
