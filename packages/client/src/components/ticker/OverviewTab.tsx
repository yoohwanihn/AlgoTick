import type { CompanyProfile } from '../../types/api.js';

function formatDate(iso?: string): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export function OverviewTab({ profile, market, exchange, currency, symbol }: {
  profile: CompanyProfile | null;
  market: string;
  exchange: string;
  currency: string;
  symbol: string;
}) {
  const name = profile?.name ?? symbol;
  return (
    <div className="space-y-6">
      {/* 회사 헤더 */}
      <div className="flex items-start gap-4">
        {profile?.logo && (
          <img
            src={profile.logo}
            alt={`${name} logo`}
            className="w-16 h-16 rounded-lg border border-slate-200 dark:border-slate-800 object-contain bg-white"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        )}
        <div className="flex-1">
          <h2 className="text-xl font-bold">{name}</h2>
          <p className="text-sm text-slate-500">
            {market} · {exchange} · {currency}
          </p>
          {profile?.weburl && (
            <a
              href={profile.weburl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-accent hover:underline mt-1 inline-block"
            >
              공식 웹사이트 ↗
            </a>
          )}
        </div>
      </div>

      {/* 기본 정보 그리드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Cell label="섹터" value={profile?.sector ?? '-'} />
        <Cell label="산업" value={profile?.industry ?? '-'} />
        <Cell label="국가" value={profile?.country ?? '-'} />
        <Cell label="IPO 일자" value={formatDate(profile?.ipo)} />
        {profile?.phone && <Cell label="전화" value={profile.phone} />}
      </div>

      {/* 회사 설명 */}
      {profile?.description && (
        <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-slate-500 uppercase mb-2">회사 소개</h4>
          <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line">{profile.description}</p>
        </div>
      )}

      {!profile && (
        <p className="text-xs text-slate-400">프로필 데이터 없음. 미주 종목은 Finnhub /profile2에서, 한주는 시드 기반.</p>
      )}
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3">
      <div className="text-xs text-slate-500 uppercase">{label}</div>
      <div className="text-sm mt-1 font-medium">{value}</div>
    </div>
  );
}
