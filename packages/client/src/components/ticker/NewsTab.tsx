import type { NewsItem } from '../../types/api.js';

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const ms = Date.now() - d.getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export function NewsTab({ news }: { news: NewsItem[] }) {
  if (news.length === 0) {
    return (
      <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-8 text-center text-slate-500">
        <p className="text-sm">뉴스 없음</p>
        <p className="text-xs mt-1">갱신 후 잠시 후 표시됩니다.</p>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-slate-200 dark:divide-slate-800">
      {news.map((n) => (
        <li key={n.id} className="py-3">
          <a
            href={n.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block hover:bg-slate-100 dark:hover:bg-slate-900 -mx-2 px-2 py-1 rounded"
          >
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex-1">{n.title}</h3>
              <span className="text-xs text-slate-400 shrink-0">{formatDateTime(n.publishedAt)}</span>
            </div>
            {n.summary && (
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">{n.summary}</p>
            )}
            {n.source && (
              <p className="text-xs text-slate-400 mt-1">{n.source} ↗</p>
            )}
          </a>
        </li>
      ))}
    </ul>
  );
}
