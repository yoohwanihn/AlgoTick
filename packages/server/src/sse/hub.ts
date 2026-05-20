import type { FastifyReply } from 'fastify';

export interface SseClient {
  id: string;
  reply: FastifyReply;
  symbols: Set<string>;
}

const clients = new Map<string, SseClient>();

export function registerClient(id: string, reply: FastifyReply): SseClient {
  const client: SseClient = { id, reply, symbols: new Set() };
  clients.set(id, client);
  return client;
}

export function removeClient(id: string): void {
  clients.delete(id);
}

export function subscribe(id: string, symbols: string[]): void {
  const c = clients.get(id);
  if (!c) return;
  for (const s of symbols) c.symbols.add(s);
}

export function unsubscribe(id: string, symbols: string[]): void {
  const c = clients.get(id);
  if (!c) return;
  for (const s of symbols) c.symbols.delete(s);
}

export function broadcast(symbol: string, event: string, data: unknown): void {
  for (const c of clients.values()) {
    if (!c.symbols.has(symbol)) continue;
    try {
      c.reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch { /* ignore */ }
  }
}

export function activeSymbols(): Set<string> {
  const all = new Set<string>();
  for (const c of clients.values()) for (const s of c.symbols) all.add(s);
  return all;
}

export function getClientCount(): number {
  return clients.size;
}

export function getStats(): { clients: number; uniqueSymbols: number; totalSubscriptions: number } {
  let totalSubscriptions = 0;
  const all = new Set<string>();
  for (const c of clients.values()) {
    totalSubscriptions += c.symbols.size;
    for (const s of c.symbols) all.add(s);
  }
  return { clients: clients.size, uniqueSymbols: all.size, totalSubscriptions };
}

export function _resetForTests(): void {
  clients.clear();
}
