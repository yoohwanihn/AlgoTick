import { describe, expect, it, beforeEach } from 'vitest';
import {
  registerClient, removeClient, subscribe, unsubscribe,
  activeSymbols, broadcast, getClientCount, _resetForTests,
} from '../../src/sse/hub';

class FakeReply {
  written: string[] = [];
  raw = { write: (s: string) => { this.written.push(s); } };
}

describe('SSE Hub', () => {
  beforeEach(() => { _resetForTests(); });

  it('subscribe/unsubscribe tracks symbols', () => {
    const reply = new FakeReply() as never;
    registerClient('t1', reply);
    subscribe('t1', ['AAPL', 'MSFT']);
    expect(activeSymbols().has('AAPL')).toBe(true);
    unsubscribe('t1', ['AAPL']);
    expect(activeSymbols().has('AAPL')).toBe(false);
  });

  it('broadcast sends only to subscribers', () => {
    const r1 = new FakeReply();
    const r2 = new FakeReply();
    registerClient('t2', r1 as never);
    registerClient('t3', r2 as never);
    subscribe('t2', ['AAPL']);
    broadcast('AAPL', 'quote-tick', { price: 100 });
    expect(r1.written.length).toBe(1);
    expect(r2.written.length).toBe(0);
  });

  it('getClientCount tracks registrations', () => {
    expect(getClientCount()).toBe(0);
    registerClient('t4', new FakeReply() as never);
    expect(getClientCount()).toBe(1);
    removeClient('t4');
    expect(getClientCount()).toBe(0);
  });
});
