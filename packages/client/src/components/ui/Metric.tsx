import type { Confidence, Source } from '@algotick/shared';
import { GlossaryTooltip } from './GlossaryTooltip.js';

const CONFIDENCE_ICON: Record<Confidence, string> = { actual: '●', estimated: '◐', assumed: '○' };
const CONFIDENCE_COLOR: Record<Confidence, string> = {
  actual: 'text-bull', estimated: 'text-amber-500', assumed: 'text-slate-400',
};
const CONFIDENCE_LABEL: Record<Confidence, string> = { actual: '실제', estimated: '추정', assumed: '가정' };
const SOURCE_LABEL: Record<Source, string> = {
  yahoo: 'Yahoo Finance', sec: 'SEC EDGAR', naver: '네이버 금융', dart: 'DART 공시',
  finnhub: 'Finnhub', calc: '계산값', user: '사용자 입력', assumption: '시나리오 가정',
};

interface Props {
  label: string;
  value: string;
  confidence?: Confidence;
  source?: Source;
  asOf?: string;
  formula?: string;
}

export function Metric({ label, value, confidence, source, asOf, formula }: Props) {
  const tip = confidence
    ? `${CONFIDENCE_LABEL[confidence]}${source ? ` · ${SOURCE_LABEL[source]}` : ''}${asOf ? ` · ${asOf} 기준` : ''}${formula ? ` · 공식: ${formula}` : ''}`
    : undefined;
  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 relative" title={tip}>
      {confidence && (
        <span
          className={`absolute top-2 right-2 text-xs ${CONFIDENCE_COLOR[confidence]}`}
          aria-label={`신뢰도: ${CONFIDENCE_LABEL[confidence]}`}
        >
          {CONFIDENCE_ICON[confidence]}
        </span>
      )}
      <div className="text-xs text-slate-500 uppercase flex items-center">
        {label}
        <GlossaryTooltip label={label} />
      </div>
      <div className="text-lg font-semibold mt-1">{value}</div>
    </div>
  );
}
