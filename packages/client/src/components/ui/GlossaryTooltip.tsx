import { getGlossary } from '../../lib/glossary.js';

export function GlossaryTooltip({ label }: { label: string }) {
  const entry = getGlossary(label);
  if (!entry) return null;
  return (
    <span
      className="inline-block ml-1 text-xs text-slate-400 hover:text-slate-600 cursor-help"
      title={`${entry.term}\n\n${entry.short}`}
      aria-label={`${entry.term} 설명`}
    >
      ⓘ
    </span>
  );
}
