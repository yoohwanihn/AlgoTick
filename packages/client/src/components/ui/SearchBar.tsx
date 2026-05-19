import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSearch } from '../../hooks/useSearch.js';

export function SearchBar() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const { data, isLoading } = useSearch(query);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function pick(symbol: string) {
    setQuery('');
    setOpen(false);
    navigate(`/ticker/${encodeURIComponent(symbol)}`);
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && data?.results[0]) {
      pick(data.results[0].symbol);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={ref} className="relative w-full">
      <input
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
        placeholder="🔍 티커 또는 회사명 (AAPL, 삼성전자...)"
        className="w-full px-3 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:border-accent"
        aria-label="종목 검색"
      />
      {open && query.trim().length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded shadow-lg max-h-80 overflow-y-auto z-20">
          {isLoading && <div className="px-3 py-2 text-sm text-slate-500">검색 중...</div>}
          {!isLoading && data?.results.length === 0 && (
            <div className="px-3 py-2 text-sm text-slate-500">결과 없음</div>
          )}
          {data?.results.map((r) => (
            <button
              key={r.symbol}
              onClick={() => pick(r.symbol)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 flex justify-between gap-2"
            >
              <span className="font-mono font-bold">{r.symbol}</span>
              <span className="text-slate-500 truncate">{r.nameEn ?? r.nameKo}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
