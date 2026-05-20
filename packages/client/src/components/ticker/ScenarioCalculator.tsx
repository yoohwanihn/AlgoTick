import { useState } from 'react';
import { useValuation } from '../../hooks/useValuation.js';
import type { ValuationInputs, ValuationResult } from '../../api/valuation.js';

interface ConfidenceTagProps {
  level: '실제' | '추정' | '가정';
}

function ConfidenceTag({ level }: ConfidenceTagProps) {
  const colors: Record<string, string> = {
    '실제': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
    '추정': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
    '가정': 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  };
  return (
    <span className={`inline-block text-[10px] font-medium px-1 py-0.5 rounded leading-none ml-1 ${colors[level]}`}>
      [{level}]
    </span>
  );
}

interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
  confidence: '실제' | '추정' | '가정';
}

function SliderField({ label, value, min, max, step, onChange, format, confidence }: SliderFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <label className="text-xs text-slate-600 dark:text-slate-400 flex items-center">
          {label}
          <ConfidenceTag level={confidence} />
        </label>
        <span className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">{format(value)}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 appearance-none rounded-full bg-slate-200 dark:bg-slate-700 accent-indigo-500 cursor-pointer"
      />
    </div>
  );
}

function pct(v: number) { return `${(v * 100).toFixed(1)}%`; }
function fmt2(v: number) { return v.toFixed(2); }

function SensitivityHeatmap({ waccRange, growthRange, matrix, currentPrice }: {
  waccRange: number[];
  growthRange: number[];
  matrix: number[][];
  currentPrice: number | null;
}) {
  const allValues = matrix.flat().filter((v) => v > 0);
  const minVal = allValues.length > 0 ? Math.min(...allValues) : 0;
  const maxVal = allValues.length > 0 ? Math.max(...allValues) : 1;

  function cellColor(val: number): string {
    if (val <= 0) return 'bg-slate-200 dark:bg-slate-700';
    const ratio = (val - minVal) / (maxVal - minVal || 1);
    if (ratio < 0.25) return 'bg-red-200 dark:bg-red-900/60';
    if (ratio < 0.5) return 'bg-amber-100 dark:bg-amber-900/40';
    if (ratio < 0.75) return 'bg-emerald-100 dark:bg-emerald-900/40';
    return 'bg-emerald-300 dark:bg-emerald-700/60';
  }

  function textColor(val: number): string {
    if (!currentPrice || val <= 0) return 'text-slate-500 dark:text-slate-400';
    const diff = (val - currentPrice) / currentPrice;
    return diff >= 0 ? 'text-emerald-700 dark:text-emerald-300 font-semibold' : 'text-red-600 dark:text-red-400';
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            <th className="text-left px-2 py-1 text-slate-500 text-[10px]">WACC \ 성장률</th>
            {growthRange.map((g) => (
              <th key={g} className="px-2 py-1 text-center font-mono text-slate-500 text-[10px]">{pct(g)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, ri) => (
            <tr key={ri}>
              <td className="px-2 py-1 font-mono text-slate-500 text-[10px]">{waccRange[ri] !== undefined ? pct(waccRange[ri]) : '-'}</td>
              {row.map((val, ci) => (
                <td key={ci} className={`px-2 py-1.5 text-center rounded ${cellColor(val)} ${textColor(val)}`}>
                  {val > 0 ? val.toFixed(0) : '-'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResultPanel({ result }: { result: ValuationResult }) {
  const { currentPrice, currency, inputs, reverseDcf, forwardDcf, comps, sensitivity } = result;
  const weighted = forwardDcf.probabilityWeightedPerShare;
  const maxShare = Math.max(...forwardDcf.scenarios.map((s) => s.perShare));
  const wUpside = forwardDcf.upsideToWeighted;
  const wUpsideColor = wUpside === null ? 'text-slate-400' : wUpside >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400';

  return (
    <div className="space-y-6 mt-4">
      {/* 핵심 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3">
          <p className="text-xs text-slate-500 mb-1 flex items-center">WACC <ConfidenceTag level="가정" /></p>
          <p className="text-lg font-bold font-mono text-slate-700 dark:text-slate-200">{pct(inputs.wacc)}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">rf={pct(inputs.rf)} + β{fmt2(inputs.beta)}×ERP{pct(inputs.erp)}</p>
        </div>
        <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3">
          <p className="text-xs text-slate-500 mb-1 flex items-center">FCF Base <ConfidenceTag level="추정" /></p>
          <p className="text-lg font-bold font-mono text-slate-700 dark:text-slate-200">
            {inputs.fcfBase >= 1e9 ? `${(inputs.fcfBase / 1e9).toFixed(1)}B` : `${(inputs.fcfBase / 1e6).toFixed(0)}M`}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">{inputs.fcfBaseOriginEstimate}</p>
        </div>
        <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3">
          <p className="text-xs text-slate-500 mb-1 flex items-center">확률가중 적정주가 <ConfidenceTag level="추정" /></p>
          <p className="text-lg font-bold font-mono text-slate-700 dark:text-slate-200">
            {currency} {weighted > 0 ? weighted.toFixed(1) : '-'}
          </p>
          {currentPrice && <p className="text-[10px] text-slate-400 mt-0.5">현재가 {currency} {currentPrice.toFixed(1)}</p>}
        </div>
        <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3">
          <p className="text-xs text-slate-500 mb-1">업사이드</p>
          <p className={`text-lg font-bold font-mono ${wUpsideColor}`}>
            {wUpside !== null ? `${wUpside >= 0 ? '+' : ''}${wUpside.toFixed(1)}%` : '-'}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">확률가중 기준</p>
        </div>
      </div>

      {/* Reverse DCF */}
      {reverseDcf.note && (
        <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-lg p-3">
          <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-1">역방향 DCF (시장 내재 성장률)</p>
          <p className="text-sm text-indigo-800 dark:text-indigo-200">{reverseDcf.note}</p>
          {reverseDcf.impliedGrowthHigh !== null && (
            <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-1">내재 성장률: {pct(reverseDcf.impliedGrowthHigh)}</p>
          )}
        </div>
      )}

      {/* Forward DCF 시나리오 */}
      <div>
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Forward DCF 시나리오</h4>
        <div className="space-y-4">
          {forwardDcf.scenarios.map((sc) => (
            <div key={sc.name} className="border border-slate-100 dark:border-slate-800 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-2 h-2 rounded-full ${sc.name === 'bull' ? 'bg-emerald-500' : sc.name === 'base' ? 'bg-indigo-500' : 'bg-red-400'}`} />
                <span className="text-xs font-bold uppercase text-slate-600 dark:text-slate-400">{sc.name}</span>
                <span className="text-xs text-slate-400">성장률 {pct(sc.growthHigh)} · 확률 {Math.round(sc.prob * 100)}%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-3 relative overflow-hidden">
                  <div
                    className={`h-full ${sc.name === 'bull' ? 'bg-emerald-500' : sc.name === 'base' ? 'bg-indigo-500' : 'bg-red-400'} rounded-full transition-all`}
                    style={{ width: `${maxShare > 0 ? Math.round((sc.perShare / maxShare) * 100) : 0}%` }}
                  />
                </div>
                <span className="font-mono text-sm font-bold text-slate-700 dark:text-slate-200 w-20 text-right">
                  {currency} {sc.perShare > 0 ? sc.perShare.toFixed(1) : '-'}
                </span>
                <span className={`font-mono text-sm font-bold w-16 text-right ${sc.upside !== null ? (sc.upside >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400') : 'text-slate-400'}`}>
                  {sc.upside !== null ? `${sc.upside >= 0 ? '+' : ''}${sc.upside.toFixed(1)}%` : '-'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Comps */}
      {comps.peerSector && (
        <div>
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">동종 업체 비교 (Comps)</h4>
          <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900">
                <tr>
                  <th className="text-left px-3 py-2 text-slate-500 uppercase text-[10px]">섹터</th>
                  <th className="text-right px-3 py-2 text-slate-500 uppercase text-[10px]">피어 수</th>
                  <th className="text-right px-3 py-2 text-slate-500 uppercase text-[10px]">평균 PER</th>
                  <th className="text-right px-3 py-2 text-slate-500 uppercase text-[10px]">평균 PBR</th>
                  <th className="text-right px-3 py-2 text-slate-500 uppercase text-[10px]">평균 PSR</th>
                  <th className="text-right px-3 py-2 text-slate-500 uppercase text-[10px]">PER 내재가</th>
                  <th className="text-right px-3 py-2 text-slate-500 uppercase text-[10px]">PBR 내재가</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-slate-200 dark:border-slate-800">
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{comps.peerSector}</td>
                  <td className="px-3 py-2 text-right font-mono">{comps.peersUsed}</td>
                  <td className="px-3 py-2 text-right font-mono">{comps.avgPer !== null ? `${comps.avgPer.toFixed(1)}x` : '-'}</td>
                  <td className="px-3 py-2 text-right font-mono">{comps.avgPbr !== null ? `${comps.avgPbr.toFixed(1)}x` : '-'}</td>
                  <td className="px-3 py-2 text-right font-mono">{comps.avgPsr !== null ? `${comps.avgPsr.toFixed(1)}x` : '-'}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                    {comps.impliedPriceByPer !== null ? `${currency} ${comps.impliedPriceByPer.toFixed(1)}` : '-'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                    {comps.impliedPriceByPbr !== null ? `${currency} ${comps.impliedPriceByPbr.toFixed(1)}` : '-'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 민감도 히트맵 */}
      <div>
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
          민감도 분석 — WACC × 성장률 (적정주가 {currency})
        </h4>
        <SensitivityHeatmap
          waccRange={sensitivity.waccRange}
          growthRange={sensitivity.growthRange}
          matrix={sensitivity.matrix}
          currentPrice={currentPrice}
        />
        <p className="text-[10px] text-slate-400 mt-1">
          색상: 진할수록 높은 적정주가 / 현재가 대비 업사이드 기준 녹색·빨간색
        </p>
      </div>
    </div>
  );
}

interface ScenarioCalculatorProps {
  symbol: string;
}

export function ScenarioCalculator({ symbol }: ScenarioCalculatorProps) {
  const mutation = useValuation(symbol);

  // Inputs state (defaults per spec)
  const [rf, setRf] = useState(0.04);
  const [erp, setErp] = useState(0.055);
  const [beta, setBeta] = useState<number | ''>('');
  const [terminalGrowth, setTerminalGrowth] = useState(0.025);
  const [forecastYears, setForecastYears] = useState(5);
  const [fcfBaseOverride, setFcfBaseOverride] = useState<number | ''>('');

  // Scenario sliders
  const [bullGrowth, setBullGrowth] = useState(0.20);
  const [bullProb, setBullProb] = useState(0.25);
  const [baseGrowth, setBaseGrowth] = useState(0.10);
  const [baseProb, setBaseProb] = useState(0.50);
  const [bearGrowth, setBearGrowth] = useState(0.03);
  const [bearProb, setBearProb] = useState(0.25);

  const totalProb = bullProb + baseProb + bearProb;
  const probOk = Math.abs(totalProb - 1.0) < 0.001;

  const handleCalculate = () => {
    const inputs: ValuationInputs = {
      rf,
      erp,
      ...(beta !== '' ? { beta: Number(beta) } : {}),
      terminalGrowth,
      forecastYears,
      ...(fcfBaseOverride !== '' ? { fcfBaseOverride: Number(fcfBaseOverride) } : {}),
      scenarios: {
        bull: { growthHigh: bullGrowth, prob: bullProb },
        base: { growthHigh: baseGrowth, prob: baseProb },
        bear: { growthHigh: bearGrowth, prob: bearProb },
      },
    };
    mutation.mutate(inputs);
  };

  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
          시나리오 분석
        </h3>
        <span className="text-xs text-slate-400">서버 계산 · 캐싱 없음</span>
      </div>

      {/* Input Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
        {/* Market inputs */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">시장 파라미터</p>
          <SliderField
            label="무위험수익률 (rf)"
            value={rf} min={0} max={0.10} step={0.005}
            onChange={setRf} format={pct} confidence="가정"
          />
          <SliderField
            label="주식위험프리미엄 (ERP)"
            value={erp} min={0.02} max={0.10} step={0.005}
            onChange={setErp} format={pct} confidence="가정"
          />
          <SliderField
            label="터미널 성장률"
            value={terminalGrowth} min={0} max={0.05} step={0.005}
            onChange={setTerminalGrowth} format={pct} confidence="가정"
          />
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-600 dark:text-slate-400 flex items-center">
              베타 (β)
              <ConfidenceTag level="추정" />
            </label>
            <input
              type="number" min={0.1} max={3} step={0.1}
              value={beta}
              placeholder="자동 (재무 데이터 또는 1.0)"
              onChange={(e) => setBeta(e.target.value === '' ? '' : Number(e.target.value))}
              className="border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 w-full"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-600 dark:text-slate-400 flex items-center">
              예측 기간 (년)
              <ConfidenceTag level="가정" />
            </label>
            <input
              type="number" min={3} max={15} step={1}
              value={forecastYears}
              onChange={(e) => setForecastYears(Number(e.target.value))}
              className="border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 w-full"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-600 dark:text-slate-400 flex items-center">
              FCF Base 직접 입력 ($)
              <ConfidenceTag level="가정" />
            </label>
            <input
              type="number" min={0} step={1_000_000}
              value={fcfBaseOverride}
              placeholder="비워두면 자동 추정"
              onChange={(e) => setFcfBaseOverride(e.target.value === '' ? '' : Number(e.target.value))}
              className="border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 w-full"
            />
          </div>
        </div>

        {/* Scenarios */}
        <div className="space-y-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            시나리오 설정
            <span className={`ml-2 text-[10px] ${probOk ? 'text-emerald-500' : 'text-red-500'}`}>
              {probOk ? '✅ 확률합 100%' : `⚠ 확률합 ${(totalProb * 100).toFixed(0)}% (100% 필요)`}
            </span>
          </p>

          {/* Bull */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Bull</span>
            <SliderField label="성장률" value={bullGrowth} min={-0.05} max={0.50} step={0.01} onChange={setBullGrowth} format={pct} confidence="가정" />
            <SliderField label="확률" value={bullProb} min={0} max={1} step={0.05} onChange={setBullProb} format={pct} confidence="가정" />
          </div>

          {/* Base */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">Base</span>
            <SliderField label="성장률" value={baseGrowth} min={-0.05} max={0.50} step={0.01} onChange={setBaseGrowth} format={pct} confidence="가정" />
            <SliderField label="확률" value={baseProb} min={0} max={1} step={0.05} onChange={setBaseProb} format={pct} confidence="가정" />
          </div>

          {/* Bear */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-red-500 dark:text-red-400">Bear</span>
            <SliderField label="성장률" value={bearGrowth} min={-0.05} max={0.50} step={0.01} onChange={setBearGrowth} format={pct} confidence="가정" />
            <SliderField label="확률" value={bearProb} min={0} max={1} step={0.05} onChange={setBearProb} format={pct} confidence="가정" />
          </div>
        </div>
      </div>

      {/* Calculate Button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleCalculate}
          disabled={mutation.isPending}
          className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2"
        >
          {mutation.isPending ? '계산 중...' : '계산'}
        </button>
        {mutation.isError && (
          <p className="text-xs text-red-500">오류: {(mutation.error as Error).message}</p>
        )}
        {mutation.isSuccess && !mutation.isPending && (
          <p className="text-xs text-emerald-500">완료</p>
        )}
      </div>

      {/* Results */}
      {mutation.data && <ResultPanel result={mutation.data} />}
    </div>
  );
}
