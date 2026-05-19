import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { Layout } from './components/layout/Layout.js';
import { NotFoundPage } from './routes/NotFoundPage.js';
import { SearchPage } from './routes/SearchPage.js';
import { TickerDetailPage } from './routes/TickerDetailPage.js';

function DashboardPlaceholder() {
  return (
    <div className="py-12">
      <h2 className="text-2xl font-bold mb-4">대시보드</h2>
      <p className="text-slate-500">관심종목이 비어있어요. 헤더에서 종목을 검색해보세요.</p>
      <Link to="/ticker/AAPL" className="inline-block mt-4 text-accent hover:underline">
        AAPL 상세 보기 (테스트 링크) →
      </Link>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<DashboardPlaceholder />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/ticker/:symbol" element={<TickerDetailPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
