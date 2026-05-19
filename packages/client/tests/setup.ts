import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { setupServer } from 'msw/node';
import { handlers } from './mocks/handlers.js';

// jsdom does not implement EventSource; stub it so useSseTick/connectSse don't throw
if (typeof globalThis.EventSource === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).EventSource = class FakeEventSource {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSED = 2;
    readonly CONNECTING = 0;
    readonly OPEN = 1;
    readonly CLOSED = 2;
    readyState = 1;
    url: string;
    constructor(url: string) { this.url = url; }
    addEventListener() { /* noop */ }
    removeEventListener() { /* noop */ }
    close() { /* noop */ }
    dispatchEvent() { return true; }
  };
}

export const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
