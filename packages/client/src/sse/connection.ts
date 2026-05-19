let es: EventSource | null = null;
let clientId: string | null = null;

const API = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

type TickHandler = (data: { symbol: string; price: number; changePct: number; volume: number; ts: string }) => void;
const tickHandlers = new Set<TickHandler>();

export function getClientId(): string | null { return clientId; }

export function connectSse(): void {
  if (es) return;
  es = new EventSource(`${API}/sse`);
  es.addEventListener('hello', (e) => {
    try { clientId = (JSON.parse((e as MessageEvent).data) as { id: string }).id; } catch { /* */ }
  });
  es.addEventListener('quote-tick', (e) => {
    try {
      const data = JSON.parse((e as MessageEvent).data);
      for (const h of tickHandlers) h(data);
    } catch { /* */ }
  });
}

export function onTick(handler: TickHandler): () => void {
  tickHandlers.add(handler);
  return () => tickHandlers.delete(handler);
}

async function waitForClientId(timeoutMs = 3000): Promise<string | null> {
  const start = Date.now();
  while (!clientId && Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 50));
  }
  return clientId;
}

export async function subscribeSymbols(symbols: string[]): Promise<void> {
  const id = await waitForClientId();
  if (!id) return;
  await fetch(`${API}/sse/subscribe`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: id, symbols }),
  });
}

export async function unsubscribeSymbols(symbols: string[]): Promise<void> {
  if (!clientId) return;
  await fetch(`${API}/sse/unsubscribe`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, symbols }),
  });
}
