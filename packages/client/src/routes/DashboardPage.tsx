import { Link } from 'react-router-dom';
import { EmptyState } from '../components/ui/EmptyState.js';

export function DashboardPage() {
  return (
    <div className="py-6">
      <h2 className="text-2xl font-bold mb-6">대시보드</h2>
      <EmptyState
        icon="⭐"
        title="관심종목이 비어있어요"
        description="Stage 6에서 관심종목 추가 기능이 들어옵니다. 지금은 상단 검색바로 직접 종목을 찾아보세요."
        action={
          <div className="flex gap-2 justify-center flex-wrap">
            <Link to="/ticker/AAPL" className="px-3 py-1.5 bg-slate-800 text-white rounded text-sm hover:bg-slate-700">AAPL</Link>
            <Link to="/ticker/MSFT" className="px-3 py-1.5 bg-slate-800 text-white rounded text-sm hover:bg-slate-700">MSFT</Link>
            <Link to="/ticker/NVDA" className="px-3 py-1.5 bg-slate-800 text-white rounded text-sm hover:bg-slate-700">NVDA</Link>
            <Link to="/ticker/TSLA" className="px-3 py-1.5 bg-slate-800 text-white rounded text-sm hover:bg-slate-700">TSLA</Link>
          </div>
        }
      />
    </div>
  );
}
