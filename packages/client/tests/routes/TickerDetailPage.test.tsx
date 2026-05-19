import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../src/components/ticker/ChartPanel.js', () => ({
  ChartPanel: ({ candles }: { candles: unknown[] }) => <div data-testid="chart-stub">candles: {candles.length}</div>,
}));

import { TickerDetailPage } from '../../src/routes/TickerDetailPage.js';

function renderPage(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/ticker/:symbol" element={<TickerDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('TickerDetailPage', () => {
  it('shows loading then ticker header for AAPL', async () => {
    renderPage('/ticker/AAPL');
    expect(screen.getByText(/AAPL 로딩 중/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'AAPL' })).toBeInTheDocument(), { timeout: 3000 });
    expect(screen.getByText(/Apple Inc\./)).toBeInTheDocument();
    expect(screen.getByText(/\$234\.52/)).toBeInTheDocument();
  });

  it('shows error UI for 404 ticker', async () => {
    renderPage('/ticker/__NOPE__');
    await waitFor(() => expect(screen.getByText(/에러/)).toBeInTheDocument(), { timeout: 3000 });
    expect(screen.getByText(/not found/i)).toBeInTheDocument();
  });

  it('renders summary metrics with candles count', async () => {
    renderPage('/ticker/AAPL');
    await waitFor(() => expect(screen.getByText('일봉 데이터')).toBeInTheDocument(), { timeout: 3000 });
    expect(screen.getByText('2건')).toBeInTheDocument();
  });

  it('shows tab navigation with 5 tabs', async () => {
    renderPage('/ticker/AAPL');
    await waitFor(() => expect(screen.getByRole('button', { name: /차트/ })).toBeInTheDocument(), { timeout: 3000 });
    expect(screen.getByRole('button', { name: /가치평가/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /기관/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /뉴스/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /개요/ })).toBeInTheDocument();
  });
});
