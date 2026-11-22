import React from 'react';
import { Eye, ShieldCheck, WifiOff } from 'lucide-react';

interface WorkspaceToolbarProps {
  offlineSimulated: boolean;
  onToggleOffline: () => void;
  browserOnline: boolean;
  guardianMode: boolean;
  onToggleGuardianMode: () => void;
  totalLocalScans: number;
}

export const WorkspaceToolbar: React.FC<WorkspaceToolbarProps> = ({
  offlineSimulated,
  onToggleOffline,
  browserOnline,
  guardianMode,
  onToggleGuardianMode,
  totalLocalScans,
}) => {
  const effectiveOffline = offlineSimulated || !browserOnline;

  return (
    <div className="border-b border-slate-200 bg-slate-50/80">
      <div className="mx-auto flex max-w-[1360px] flex-wrap items-center justify-between gap-4 px-6 py-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <ShieldCheck className="h-4 w-4 text-emerald-700 shrink-0" />
          <span className="font-medium text-slate-800">On-Device Inference Active</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">0 bytes transmitted externally</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">{totalLocalScans} local scans</span>
          {effectiveOffline && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-medium text-amber-800">
                {offlineSimulated ? 'Airplane Mode Simulation On' : 'Device Offline — Running Locally'}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleOffline}
            aria-pressed={offlineSimulated}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
              offlineSimulated
                ? 'border-amber-300 bg-amber-50 text-amber-900'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            <WifiOff className="h-3.5 w-3.5" />
            {offlineSimulated ? 'Offline Mode: On' : 'Simulate Offline'}
          </button>

          <button
            type="button"
            onClick={onToggleGuardianMode}
            aria-pressed={guardianMode}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
              guardianMode
                ? 'border-blue-700 bg-blue-700 text-white'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            {guardianMode ? 'Senior Guardian Mode: On' : 'Senior Guardian Mode'}
          </button>
        </div>
      </div>
    </div>
  );
};
