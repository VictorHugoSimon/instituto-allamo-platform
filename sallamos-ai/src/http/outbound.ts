export interface OutboundOptions {
  timeoutMs: number;
  retries?: number;
  retryStatuses?: number[];
}

const DEFAULT_RETRY = [408, 429, 500, 502, 503, 504];

export async function fetchWithTimeout(url: string, init: RequestInit, options: OutboundOptions): Promise<Response> {
  const retries = Math.max(0, Math.min(2, options.retries ?? 0));
  const retryStatuses = new Set(options.retryStatuses ?? DEFAULT_RETRY);
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort('timeout'), Math.max(250, options.timeoutMs));
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      if (attempt < retries && retryStatuses.has(res.status)) {
        lastError = new Error('retryable_http_' + res.status);
        continue;
      }
      return res;
    } catch (error) {
      lastError = error;
      if (attempt >= retries) throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError ?? new Error('outbound_failed');
}

export function timeoutFrom(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(250, Math.min(10000, parsed)) : fallback;
}
