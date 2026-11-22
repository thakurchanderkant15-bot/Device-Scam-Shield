import { useEffect, useMemo, useState } from 'react';
import { Header, ActiveTab } from './components/Header';
import { WorkspaceToolbar } from './components/WorkspaceToolbar';
import { AnalyzerView } from './components/AnalyzerView';
import { CaseLibraryView } from './components/CaseLibraryView';
import { VoiceGuardView } from './components/VoiceGuardView';
import { ArchitectureView } from './components/ArchitectureView';
import {
  analyzeCommunication,
  loadAdaptiveMemory,
  resetAdaptiveMemory,
  teachAdaptiveModel,
} from './engine/scamModel';
import { AdaptiveMemoryState, ChannelType, LocalAuditEntry } from './engine/types';
import { SAMPLE_CASES } from './data/sampleCases';

const UNSEEN_CASES = SAMPLE_CASES.filter((c) => c.category === 'unseen_obfuscated');

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('analyzer');
  const [channel, setChannel] = useState<ChannelType>('sms');
  const [inputText, setInputText] = useState<string>(SAMPLE_CASES[4].content); // USPS Customs Phish default
  const [offlineSimulated, setOfflineSimulated] = useState<boolean>(false);
  const [browserOnline, setBrowserOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [guardianMode, setGuardianMode] = useState<boolean>(false);
  const [adaptiveMemory, setAdaptiveMemory] = useState<AdaptiveMemoryState>(() =>
    loadAdaptiveMemory()
  );
  const [unseenCursor, setUnseenCursor] = useState<number>(0);
  const [auditLog, setAuditLog] = useState<LocalAuditEntry[]>(() => {
    const initial = analyzeCommunication(SAMPLE_CASES[4].content, 'sms');
    return [
      {
        id: initial.id,
        timestamp: initial.timestamp,
        channel: 'sms',
        preview: SAMPLE_CASES[4].content.slice(0, 72),
        riskScore: initial.riskScore,
        riskLevel: initial.riskLevel,
        processingTimeMs: initial.processingTimeMs,
        bytesTransmittedExternally: 0,
      },
    ];
  });

  useEffect(() => {
    const handleOnline = () => setBrowserOnline(true);
    const handleOffline = () => setBrowserOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const result = useMemo(() => {
    // Re-evaluate whenever inputText, channel, or adaptiveMemory updates
    void adaptiveMemory;
    return analyzeCommunication(inputText, channel);
  }, [inputText, channel, adaptiveMemory]);

  const handleRecordScan = () => {
    if (!inputText.trim()) return;
    setAuditLog((prev) => [
      {
        id: result.id,
        timestamp: Date.now(),
        channel,
        preview: inputText.trim().slice(0, 72),
        riskScore: result.riskScore,
        riskLevel: result.riskLevel,
        processingTimeMs: result.processingTimeMs,
        bytesTransmittedExternally: 0,
      },
      ...prev.slice(0, 24),
    ]);
  };

  const handleTeachModel = (label: 'scam' | 'safe') => {
    const updated = teachAdaptiveModel(inputText, label);
    setAdaptiveMemory({ ...updated });
  };

  const handleResetAdaptive = () => {
    const cleared = resetAdaptiveMemory();
    setAdaptiveMemory({ ...cleared });
  };

  const handleTestUnseenScam = () => {
    const nextCase = UNSEEN_CASES[unseenCursor % UNSEEN_CASES.length];
    setUnseenCursor((c) => c + 1);
    setChannel(nextCase.channel);
    setInputText(nextCase.content);
    setActiveTab('analyzer');
    const nextEval = analyzeCommunication(nextCase.content, nextCase.channel);
    setAuditLog((prev) => [
      {
        id: nextEval.id,
        timestamp: Date.now(),
        channel: nextCase.channel,
        preview: nextCase.content.slice(0, 72),
        riskScore: nextEval.riskScore,
        riskLevel: nextEval.riskLevel,
        processingTimeMs: nextEval.processingTimeMs,
        bytesTransmittedExternally: 0,
      },
      ...prev.slice(0, 24),
    ]);
  };

  const handleLoadInAnalyzer = (text: string, ch: ChannelType) => {
    setChannel(ch);
    setInputText(text);
    setActiveTab('analyzer');
    const evalRes = analyzeCommunication(text, ch);
    setAuditLog((prev) => [
      {
        id: evalRes.id,
        timestamp: Date.now(),
        channel: ch,
        preview: text.slice(0, 72),
        riskScore: evalRes.riskScore,
        riskLevel: evalRes.riskLevel,
        processingTimeMs: evalRes.processingTimeMs,
        bytesTransmittedExternally: 0,
      },
      ...prev.slice(0, 24),
    ]);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onTestUnseenScam={handleTestUnseenScam}
      />
      <WorkspaceToolbar
        offlineSimulated={offlineSimulated}
        onToggleOffline={() => setOfflineSimulated((v) => !v)}
        browserOnline={browserOnline}
        guardianMode={guardianMode}
        onToggleGuardianMode={() => setGuardianMode((v) => !v)}
        totalLocalScans={auditLog.length}
      />

      <main className="flex-1">
        {activeTab === 'analyzer' && (
          <AnalyzerView
            channel={channel}
            onChannelChange={setChannel}
            inputText={inputText}
            onInputChange={setInputText}
            result={result}
            guardianMode={guardianMode}
            adaptiveMemory={adaptiveMemory}
            onTeachModel={handleTeachModel}
            onRecordScan={handleRecordScan}
          />
        )}
        {activeTab === 'library' && (
          <CaseLibraryView onLoadInAnalyzer={handleLoadInAnalyzer} />
        )}
        {activeTab === 'voice' && <VoiceGuardView guardianMode={guardianMode} />}
        {activeTab === 'architecture' && (
          <ArchitectureView
            auditLog={auditLog}
            adaptiveMemory={adaptiveMemory}
            onResetAdaptive={handleResetAdaptive}
          />
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 px-6">
        <div className="mx-auto flex max-w-[1360px] flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <span>Aegis Local — Privacy-Preserving On-Device Scam Protection</span>
          <span>All message, link, and call analysis runs strictly in local device memory.</span>
        </div>
      </footer>
    </div>
  );
}
