import { apiUrl } from './config';

// The API contract: { ok: true, data } on success, { ok: false, message, code } on error.
// The surface is GET + POST only (template rule), so these two helpers are all a page needs.

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), init);

  // A proxy or crash can answer with HTML/plain text — don't let JSON parsing
  // turn that into a cryptic "Unexpected token <" for the user.
  let result: { ok?: boolean; data?: T; message?: string; code?: string } | null = null;
  try {
    result = await response.json();
  } catch {
    result = null;
  }

  if (!response.ok || !result?.ok) {
    throw new ApiError(result?.message || `Request failed (${response.status})`, response.status, result?.code);
  }
  return result.data as T;
}

export function getJson<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'GET' });
}

// Content-Type is set ONLY when there is a body: Fastify rejects an empty body
// declared as application/json (FST_ERR_CTP_EMPTY_JSON_BODY), which broke
// body-less POSTs such as logout in several apps built from this template.
export function postJson<T>(path: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method: 'POST' };
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  return request<T>(path, init);
}
