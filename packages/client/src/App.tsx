import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout.js';
import { NotFoundPage } from './routes/NotFoundPage.js';
import { SearchPage } from './routes/SearchPage.js';
import { TickerDetailPage } from './routes/TickerDetailPage.js';
import { DashboardPage } from './routes/DashboardPage.js';
import { PortfolioPage } from './routes/PortfolioPage.js';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/ticker/:symbol" element={<TickerDetailPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
