import { useSearchParams, Link } from 'react-router-dom';
import { useSearch } from '../hooks/useSearch.js';

export function SearchPage() {
  const [params] = useSearchParams();
  const q = params.get('q') ?? '';
  const { data, isLoading, error } = useSearch(q);

  return (
    <div className="py-6">
      <h2 className="text-xl font-bold mb-4">"{q}" 검색 결과</h2>
      {isLoading && <p className="text-slate-500">검색 중...</p>}
      {error && <p className="text-bear">에러: {(error as Error).message}</p>}
      {data?.results.length === 0 && <p className="text-slate-500">결과 없음</p>}
      <ul className="divide-y divide-slate-200 dark:divide-slate-800">
        {data?.results.map((r) => (
          <li key={r.symbol} className="py-3">
            <Link
              to={`/ticker/${encodeURIComponent(r.symbol)}`}
              className="flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-900 -mx-2 px-2 py-1 rounded"
            >
              <span className="font-mono font-bold w-24">{r.symbol}</span>
              <span className="flex-1 text-slate-700 dark:text-slate-300">{r.nameKo ?? r.nameEn}</span>
              <span className="text-xs text-slate-500">{r.exchange}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
