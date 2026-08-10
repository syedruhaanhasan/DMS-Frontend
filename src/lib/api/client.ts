const TOKEN_KEY = "wdas.token";

/** Empty in dev (Vite proxies /api → backend). Set to e.g. https://localhost:5110 when frontend and API are on different origins. */
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

export function apiPath(path: string): string {
  if (!API_BASE || path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

type RequestOptions = Omit<RequestInit, "body"> & { body?: unknown };

const REQUEST_TIMEOUT_MS = 45_000;

let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

async function parseError(res: Response): Promise<{ message: string; body?: unknown }> {
  try {
    const data = await res.json();
    const message =
      typeof data?.error === "string" ? data.error
      : typeof data?.message === "string" ? data.message
      : typeof data?.title === "string" ? data.title
      : res.statusText || `Request failed (${res.status})`;
    return { message, body: data };
  } catch {
    return { message: res.statusText || `Request failed (${res.status})` };
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, signal, ...rest } = options;
  const token = getToken();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);

  let res: Response;
  try {
    res = await fetch(apiPath(path), {
      ...rest,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError(
        "Request timed out. Is the backend running? Start it with: dotnet run --project backend/src/WDAS.Api/WDAS.Api.csproj --urls https://localhost:5110",
        0,
      );
    }
    throw new ApiError("Cannot reach the API. Is the backend running on https://localhost:5110?", 0);
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", onAbort);
  }

  if (!res.ok) {
    // Only clear session on auth failure — 403 is a permission denial on a valid session.
    if (res.status === 401) {
      onUnauthorized?.();
    }
    const { message, body: errorBody } = await parseError(res);
    throw new ApiError(message, res.status, errorBody);
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export const api = {
  get: <T>(path: string) => apiRequest<T>(path),
  post: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: "POST", body }),
  put: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: "PUT", body }),
  patch: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: "PATCH", body }),
  delete: <T>(path: string) => apiRequest<T>(path, { method: "DELETE" }),
};

export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const token = getToken();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(apiPath(path), {
      method: "POST",
      signal: controller.signal,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError("Upload timed out. Check that the backend is running.", 0);
    }
    throw new ApiError("Cannot reach the API. Is the backend running on https://localhost:5110?", 0);
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    if (res.status === 401) {
      onUnauthorized?.();
    }
    const { message, body: errorBody } = await parseError(res);
    throw new ApiError(message, res.status, errorBody);
  }

  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}
