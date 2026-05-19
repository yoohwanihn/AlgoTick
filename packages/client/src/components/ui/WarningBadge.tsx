import { useState } from 'react';
import type { ValidationResult } from '@algotick/shared';

const SEVERITY_COLOR: Record<ValidationResult['severity'], string> = {
  error: 'bg-bear text-white',
  warning: 'bg-amber-400 text-slate-900',
  info: 'bg-slate-300 text-slate-900',
};

const SEVERITY_LABEL: Record<ValidationResult['severity'], string> = {
  error: '오류', warning: '경고', info: '안내',
};

export function WarningBadge({ warnings }: { warnings: ValidationResult[] }) {
  const [open, setOpen] = useState(false);
  if (warnings.length === 0) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 hover:bg-amber-200"
        aria-label={`데이터 경고 ${warnings.length}건`}
      >
        🟡 데이터 경고 {warnings.length}건
      </button>
      {open && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40" onClick={() => setOpen(false)}>
          <div
            className="bg-white dark:bg-slate-900 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">데이터 검증 경고 ({warnings.length}건)</h3>
              <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-700">✕</button>
            </div>
            <ul className="space-y-2">
              {warnings.map((w, i) => (
                <li key={i} className="border-l-4 border-amber-400 pl-3 py-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${SEVERITY_COLOR[w.severity]}`}>
                      {SEVERITY_LABEL[w.severity]}
                    </span>
                    <code className="text-xs text-slate-500">{w.code}</code>
                  </div>
                  <p className="text-sm">{w.message}</p>
                  {w.details && (
                    <pre className="text-xs text-slate-500 mt-1 overflow-x-auto">
                      {JSON.stringify(w.details, null, 2)}
                    </pre>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
