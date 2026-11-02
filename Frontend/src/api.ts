import { apiUrl } from './config';

// The API contract: { ok: true, data } on success, { ok: false, message, code } on error.
// The surface is GET + POST only (template rule, enforced by the backend at boot), so these
// two helpers are all a page needs. There is deliberately no put/patch/del helper.

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly details: unknown;
  /** The whole error envelope (some errors carry `data`, e.g. /api/health's 503). */
  readonly body: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.body = body;
  }
}

/** True for a request that was cancelled (component unmounted, newer request won). */
export function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

// 401 hook — Slice 8 (auth) registers a handler that clears the session and sends the user
// to /login. Until then nothing is registered and a 401 is just an ApiError.
type UnauthorizedHandler = (err: ApiError) => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

/** Register the 401 handler; returns an unregister function. */
export function onUnauthorized(handler: UnauthorizedHandler): () => void {
  unauthorizedHandler = handler;
  return () => {
    if (unauthorizedHandler === handler) unauthorizedHandler = null;
  };
}

export type RequestOptions = {
  signal?: AbortSignal;
  /** Skip the 401 hook (e.g. the sign-in call itself). */
  skipAuthHook?: boolean;
};

async function request<T>(path: string, init: RequestInit, options: RequestOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(apiUrl(path), { ...init, signal: options.signal, credentials: 'same-origin' });
  } catch (err) {
    if (isAbort(err)) throw err;
    throw new ApiError('Could not reach the server. Check your connection and try again.', 0, 'network_error');
  }

  // A proxy or crash can answer with HTML/plain text — don't let JSON parsing
  // turn that into a cryptic "Unexpected token <" for the user.
  type Envelope = { ok?: boolean; data?: T; message?: string; code?: string; details?: unknown };
  const result: Envelope | null = await response.json().catch(() => null);

  if (!response.ok || !result?.ok) {
    const error = new ApiError(
      result?.message || `Request failed (${response.status})`,
      response.status,
      result?.code,
      result?.details,
      result,
    );
    if (response.status === 401 && !options.skipAuthHook) unauthorizedHandler?.(error);
    throw error;
  }
  return result.data as T;
}

export function getJson<T>(path: string, options?: RequestOptions): Promise<T> {
  return request<T>(path, { method: 'GET' }, options);
}

// Content-Type is set ONLY when there is a body: Fastify rejects an empty body
// declared as application/json (FST_ERR_CTP_EMPTY_JSON_BODY), which broke
// body-less POSTs such as logout in several apps built from this template.
export function postJson<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
  const init: RequestInit = { method: 'POST' };
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  return request<T>(path, init, options);
}

/** A readable one-liner for any error (ApiError, network, or a bug). */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Something went wrong.';
}

/** What the files module returns (Backend/app/modules/files). Store `id`; ask for a fresh `url` when showing it. */
export type UploadedFile = { id: string; name: string; mime: string; size: number; url: string }

// Uploads a file to POST /api/files (multipart field "file") — the server's optional files module,
// driver local or Bloteb. No Content-Type header: the browser sets the multipart boundary itself.
export function uploadFile(file: File, options?: RequestOptions): Promise<UploadedFile> {
  const body = new FormData()
  body.append('file', file)
  return request<UploadedFile>('/api/files', { method: 'POST', body }, options)
}
