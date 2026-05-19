import { Link } from 'react-router-dom';
import { SearchBar } from '../ui/SearchBar.js';

export function Header() {
  return (
    <header className="border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white/80 dark:bg-slate-950/80 backdrop-blur z-10">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <Link to="/" className="text-xl font-bold text-accent shrink-0">🪙 AlgoTick</Link>
        <nav className="flex gap-4 text-sm text-slate-600 dark:text-slate-400 shrink-0">
          <Link to="/" className="hover:text-accent">대시보드</Link>
        </nav>
        <div className="flex-1 max-w-md">
          <SearchBar />
        </div>
      </div>
    </header>
  );
}
