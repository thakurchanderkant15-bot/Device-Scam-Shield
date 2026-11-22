import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, MicOff, PhoneOff, Play, RotateCcw, ShieldAlert, ShieldCheck, StepForward } from 'lucide-react';
import { VOICE_SCENARIOS, VoiceScenario } from '../data/sampleCases';
import { analyzeCommunication, analyzeVoiceCallTurns } from '../engine/scamModel';
import { VoiceTurn } from '../engine/types';

interface VoiceGuardViewProps {
  guardianMode: boolean;
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export const VoiceGuardView: React.FC<VoiceGuardViewProps> = ({ guardianMode }) => {
  const [selectedScenario, setSelectedScenario] = useState<VoiceScenario>(VOICE_SCENARIOS[0]);
  const [visibleCount, setVisibleCount] = useState<number>(VOICE_SCENARIOS[0].turns.length);
  const [isPlaying, setIsPlaying] = useState(false);
  const [customLine, setCustomLine] = useState('');
  const [customTurns, setCustomTurns] = useState<VoiceTurn[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [micNote, setMicNote] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const activeTurns = useMemo(() => {
    const base = selectedScenario.turns.slice(0, visibleCount);
    return [...base, ...customTurns];
  }, [selectedScenario, visibleCount, customTurns]);

  const assessments = useMemo(() => analyzeVoiceCallTurns(activeTurns), [activeTurns]);
  const latestAssessment = assessments[assessments.length - 1];
  const callerText = activeTurns
    .filter((t) => t.speaker === 'caller')
    .map((t) => t.text)
    .join(' ');
  const fullCallAnalysis = useMemo(
    () => analyzeCommunication(callerText, 'voice'),
    [callerText]
  );

  useEffect(() => {
    if (!isPlaying) return;
    if (visibleCount >= selectedScenario.turns.length) {
      setIsPlaying(false);
      return;
    }
    const timer = setTimeout(() => {
      setVisibleCount((prev) => Math.min(selectedScenario.turns.length, prev + 1));
    }, 1500);
    return () => clearTimeout(timer);
  }, [isPlaying, visibleCount, selectedScenario.turns.length]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // Ignore
        }
      }
    };
  }, []);

  const handleSelectScenario = (scenario: VoiceScenario) => {
    setSelectedScenario(scenario);
    setVisibleCount(1);
    setCustomTurns([]);
    setIsPlaying(true);
  };

  const handleAddCustomTurn = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customLine.trim();
    if (!trimmed) return;
    setCustomTurns((prev) => [
      ...prev,
      {
        id: `custom_${Date.now()}`,
        speaker: 'caller',
        timestampSec: (activeTurns[activeTurns.length - 1]?.timestampSec || 0) + 6,
        text: trimmed,
      },
    ]);
    setCustomLine('');
  };

  const toggleLiveMic = () => {
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRec) {
      setMicNote(
        'Browser speech recognition is unavailable in this sandbox. Use the simulation or type caller dialogue below to test live voice turn scoring.'
      );
      return;
    }

    try {
      const rec = new SpeechRec();
      rec.continuous = true;
      rec.interimResults = false;
      rec.lang = 'en-US';
      rec.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            const spoken = event.results[i][0].transcript.trim();
            if (spoken) {
              setCustomTurns((prev) => [
                ...prev,
                {
                  id: `mic_${Date.now()}_${i}`,
                  speaker: 'caller',
                  timestampSec: (activeTurns[activeTurns.length - 1]?.timestampSec || 0) + 5,
                  text: spoken,
                },
              ]);
            }
          }
        }
      };
      rec.onerror = () => {
        setIsListening(false);
        setMicNote('Microphone access was blocked or unavailable. You can still type caller phrases below.');
      };
      rec.onend = () => setIsListening(false);
      recognitionRef.current = rec;
      rec.start();
      setIsListening(true);
      setMicNote(null);
    } catch {
      setIsListening(false);
      setMicNote('Could not start local speech capture.');
    }
  };

  // Build SVG risk trajectory points
  const chartPoints = useMemo(() => {
    if (assessments.length === 0) return '';
    const width = 360;
    const height = 96;
    const step = assessments.length > 1 ? width / (assessments.length - 1) : width;
    return assessments
      .map((a, i) => {
        const x = assessments.length === 1 ? width / 2 : i * step;
        const y = height - (a.cumulativeRiskScore / 100) * (height - 16) - 8;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [assessments]);

  const isCriticalCall = (latestAssessment?.cumulativeRiskScore || 0) >= 65;

  return (
    <div className="mx-auto max-w-[1360px] px-6 py-8 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            On-Device Voice Call &amp; Impersonation Guard
          </h1>
          <p className="mt-1 text-sm text-slate-600 max-w-2xl">
            Monitors incoming call speech turn-by-turn locally to catch escalating authority impersonation, secrecy demands, and OTP/gift-card extortion before harm occurs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleLiveMic}
            className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              isListening
                ? 'border-red-300 bg-red-50 text-red-800'
                : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
            }`}
          >
            {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {isListening ? 'Stop Local Mic' : 'Listen via Local Mic'}
          </button>
        </div>
      </div>

      {micNote && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900">
          {micNote}
        </div>
      )}

      {/* Scenario Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {VOICE_SCENARIOS.map((sc) => {
          const active = sc.id === selectedScenario.id;
          return (
            <button
              key={sc.id}
              type="button"
              onClick={() => handleSelectScenario(sc)}
              className={`text-left rounded-xl border p-4 transition-colors ${
                active
                  ? 'border-blue-700 bg-blue-50/40'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <div className="text-xs font-semibold text-slate-900">{sc.title}</div>
              <div className="mt-1 text-[11px] text-slate-500">
                {sc.callerLabel} · {sc.category === 'scam' ? 'Simulated Impersonation' : 'Legitimate Call'}
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Live Turn Transcript */}
        <section className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">{selectedScenario.title}</h2>
              <p className="text-xs text-slate-500">{selectedScenario.summary}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setVisibleCount(1);
                  setCustomTurns([]);
                  setIsPlaying(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                <Play className="h-3.5 w-3.5" />
                Replay
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  setVisibleCount((c) => Math.min(selectedScenario.turns.length, c + 1));
                }}
                disabled={visibleCount >= selectedScenario.turns.length}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 whitespace-nowrap"
              >
                <StepForward className="h-3.5 w-3.5" />
                Next Turn
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  setVisibleCount(selectedScenario.turns.length);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Show All
              </button>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {activeTurns.map((turn, idx) => {
              const turnEval = assessments[idx];
              const isCaller = turn.speaker === 'caller';
              const flagged = (turnEval?.turnFlags.length || 0) > 0;

              return (
                <div
                  key={turn.id}
                  className={`rounded-lg border p-3.5 ${
                    isCaller && flagged
                      ? 'border-red-200 bg-red-50/50'
                      : isCaller
                      ? 'border-slate-200 bg-slate-50/70'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                    <span className="font-semibold text-slate-800">
                      {isCaller ? `Caller (${selectedScenario.callerLabel})` : 'Recipient'}
                    </span>
                    <span className="font-mono tabular-nums">
                      00:{String(turn.timestampSec).padStart(2, '0')} · Cumulative Risk{' '}
                      {turnEval?.cumulativeRiskScore ?? 0}/100
                    </span>
                  </div>
                  <p className={`mt-1.5 text-slate-900 ${guardianMode ? 'text-base' : 'text-sm'}`}>
                    {turn.text}
                  </p>
                  {isCaller && flagged && (
                    <div className="mt-2 text-[11px] font-medium text-red-800">
                      Flagged locally: {turnEval?.turnFlags.join(' · ')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add Custom Caller Utterance */}
          <form onSubmit={handleAddCustomTurn} className="mt-5 pt-4 border-t border-slate-100 flex gap-2">
            <input
              type="text"
              value={customLine}
              onChange={(e) => setCustomLine(e.target.value)}
              placeholder="Test a custom caller phrase (e.g. 'Read me the 6-digit code and do not hang up')..."
              className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none"
            />
            <button
              type="submit"
              disabled={!customLine.trim()}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-40 whitespace-nowrap shrink-0"
            >
              Analyze Turn
            </button>
          </form>
        </section>

        {/* Right: Real-time Call Intervention & Escalation Trajectory */}
        <section className="lg:col-span-5 space-y-6">
          <div
            className={`rounded-xl border p-6 ${
              isCriticalCall
                ? 'border-red-300 bg-red-50'
                : 'border-slate-200 bg-white'
            }`}
          >
            <div className="flex items-start gap-3">
              {isCriticalCall ? (
                <PhoneOff className="h-6 w-6 text-red-700 shrink-0 mt-0.5" />
              ) : (
                <ShieldCheck className="h-6 w-6 text-emerald-700 shrink-0 mt-0.5" />
              )}
              <div>
                <h2
                  className={`font-display text-lg font-bold ${
                    isCriticalCall ? 'text-red-900' : 'text-slate-900'
                  }`}
                >
                  {isCriticalCall
                    ? 'Hang Up & Verify Independently'
                    : 'Call Monitoring Active'}
                </h2>
                <p className={`mt-1 text-sm ${isCriticalCall ? 'text-red-800' : 'text-slate-600'}`}>
                  {guardianMode ? fullCallAnalysis.guardianSummary : fullCallAnalysis.summary}
                </p>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-200/70">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-semibold text-slate-800">
                  Real-Time Call Risk Trajectory
                </span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {latestAssessment?.cumulativeRiskScore ?? 0} / 100
                </span>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <svg viewBox="0 0 360 96" className="w-full h-24 overflow-visible" aria-label="Call risk escalation chart">
                  <line x1="0" y1="34" x2="360" y2="34" stroke="#FCA5A5" strokeDasharray="4 4" strokeWidth="1" />
                  <text x="2" y="30" fill="#B91C1C" fontSize="9" fontFamily="monospace">
                    Alert Threshold (65)
                  </text>
                  {chartPoints && (
                    <polyline
                      fill="none"
                      stroke={isCriticalCall ? '#DC2626' : '#1D4ED8'}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={chartPoints}
                    />
                  )}
                </svg>
              </div>
            </div>

            {fullCallAnalysis.recommendations.length > 0 && (
              <div className="mt-5 pt-4 border-t border-slate-200/70">
                <h3 className="text-xs font-semibold text-slate-900 mb-2">
                  Caller Protection Guidance
                </h3>
                <ul className="space-y-2 text-xs text-slate-800">
                  {fullCallAnalysis.recommendations.map((rec) => (
                    <li key={rec.step} className="flex items-start gap-2">
                      <ShieldAlert className="h-3.5 w-3.5 text-slate-700 mt-0.5 shrink-0" />
                      <span>
                        <strong>{rec.action}:</strong> {rec.detail}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
