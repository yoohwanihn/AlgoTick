import type { Signal } from '../../types/api.js';

const SEV_BORDER: Record<Signal['severity'], string> = {
  positive: 'border-bull',
  negative: 'border-bear',
  warning: 'border-amber-500',
  info: 'border-slate-400',
};

const SEV_BG: Record<Signal['severity'], string> = {
  positive: 'bg-bull/10',
  negative: 'bg-bear/10',
  warning: 'bg-amber-100 dark:bg-amber-900/40',
  info: 'bg-slate-100 dark:bg-slate-800',
};

const SEV_TEXT: Record<Signal['severity'], string> = {
  positive: 'text-bull',
  negative: 'text-bear',
  warning: 'text-amber-800 dark:text-amber-200',
  info: 'text-slate-700 dark:text-slate-300',
};

const SEV_ICON: Record<Signal['severity'], string> = {
  positive: '▲', negative: '▼', warning: '●', info: '●',
};

export function SignalPanel({ signals }: { signals: Signal[] }) {
  if (signals.length === 0) {
    return (
      <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 text-sm text-slate-500">
        현재 감지된 기술 신호 없음
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">🧠 최근 신호 ({signals.length})</h4>
      {signals.map((s, i) => (
        <div key={i} className={`border-l-4 rounded p-3 text-sm ${SEV_BORDER[s.severity]} ${SEV_BG[s.severity]} ${SEV_TEXT[s.severity]}`}>
          <div className="flex items-center gap-2 font-semibold">
            <span>{SEV_ICON[s.severity]}</span>
            <code className="text-xs opacity-70">{s.code}</code>
            <span className="ml-auto text-xs opacity-60">{s.date}</span>
          </div>
          <div className="mt-1">{s.message}</div>
        </div>
      ))}
    </div>
  );
}
