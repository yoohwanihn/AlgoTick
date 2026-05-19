const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: { accept: 'application/json' } });
  if (!res.ok) {
    let code = 'HTTP_ERROR';
    let msg = `HTTP ${res.status}`;
    try {
      const body = await res.json() as { error?: { code?: string; message?: string } };
      if (body.error?.code) code = body.error.code;
      if (body.error?.message) msg = body.error.message;
    } catch { /* ignore */ }
    throw new ApiError(res.status, code, msg);
  }
  return (await res.json()) as T;
}
