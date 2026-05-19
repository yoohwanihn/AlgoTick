import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SearchBar } from '../../src/components/ui/SearchBar.js';

function renderSearchBar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <BrowserRouter>
      <QueryClientProvider client={qc}>
        <SearchBar />
      </QueryClientProvider>
    </BrowserRouter>,
  );
}

describe('SearchBar', () => {
  it('shows placeholder input', () => {
    renderSearchBar();
    expect(screen.getByPlaceholderText(/티커 또는 회사명/)).toBeInTheDocument();
  });

  it('queries API on input and shows results', async () => {
    const user = userEvent.setup();
    renderSearchBar();
    await user.type(screen.getByLabelText('종목 검색'), 'aapl');
    await waitFor(() => expect(screen.getByText('AAPL')).toBeInTheDocument(), { timeout: 3000 });
    expect(screen.getByText(/Apple Inc\./)).toBeInTheDocument();
  });

  it('shows "결과 없음" when no matches', async () => {
    const user = userEvent.setup();
    renderSearchBar();
    await user.type(screen.getByLabelText('종목 검색'), 'zzzzzz');
    await waitFor(() => expect(screen.getByText('결과 없음')).toBeInTheDocument(), { timeout: 3000 });
  });
});
