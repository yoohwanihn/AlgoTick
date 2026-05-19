import { refreshIndices, refreshMarketContent } from '../../services/marketService.js';

export async function refreshMarket(): Promise<void> {
  await refreshIndices();
  await refreshMarketContent();
}
