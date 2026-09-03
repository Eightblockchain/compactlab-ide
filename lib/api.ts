export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const TOKEN_KEY = "compactlab_token";

export type PlanSlug = "free" | "paid";

export type UserPublic = {
  id: string;
  email: string;
  name: string | null;
  imageUrl: string | null;
  createdAt: string;
  planSlug: PlanSlug;
};

export type Entitlements = {
  planSlug: PlanSlug;
  planName: string;
  zkCompilePerHour: number;
  skipZkPerHour: number;
  indexerPerMinute: number;
  maxProjects: number;
  compileAllowed: boolean;
  banned: boolean;
  overrideNote?: string | null;
};

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.json !== undefined) headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE.replace(/\/$/, "")}${path}`, {
    ...init,
    headers,
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
    credentials: "include",
  });

  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!res.ok) {
    const msg =
      typeof body === "object" && body && "error" in body
        ? String((body as { error: unknown }).error)
        : res.statusText;
    throw new ApiError(msg || "Request failed", res.status, body);
  }
  return body as T;
}

export function createBrowserApi() {
  return {
    signup: (body: { email: string; password: string; name?: string }) =>
      request<{ user: UserPublic; token: string; entitlements: Entitlements }>(
        "/v1/auth/signup",
        { method: "POST", json: body },
      ),
    login: (body: { email: string; password: string }) =>
      request<{ user: UserPublic; token: string; entitlements: Entitlements }>(
        "/v1/auth/login",
        { method: "POST", json: body },
      ),
    logout: () => request<{ ok: true }>("/v1/auth/logout", { method: "POST" }),
    me: () =>
      request<{ user: UserPublic; entitlements: Entitlements }>("/v1/me"),
    exchangeOAuthCode: (code: string) =>
      request<{ user: UserPublic; token: string; entitlements: Entitlements }>(
        "/v1/auth/oauth/exchange",
        { method: "POST", json: { code } },
      ),
    checkout: (body?: { successUrl?: string; cancelUrl?: string }) =>
      request<{ url: string }>("/v1/billing/checkout", {
        method: "POST",
        json: body ?? {},
      }),
    portal: (body?: { returnUrl?: string }) =>
      request<{ url: string }>("/v1/billing/portal", {
        method: "POST",
        json: body ?? {},
      }),
    listProjects: (full = true) =>
      request<{ projects: CloudProject[] }>(
        `/v1/projects${full ? "?full=1" : ""}`,
      ),
    getProject: (id: string) =>
      request<{ project: CloudProject }>(`/v1/projects/${id}`),
    createProject: (body: CloudProjectUpsert) =>
      request<{ project: CloudProject }>("/v1/projects", {
        method: "POST",
        json: body,
      }),
    updateProject: (id: string, body: CloudProjectPatch) =>
      request<{ project: CloudProject }>(`/v1/projects/${id}`, {
        method: "PATCH",
        json: body,
      }),
    deleteProject: (id: string) =>
      request<{ ok: true }>(`/v1/projects/${id}`, { method: "DELETE" }),
  };
}

export type CloudProject = {
  id: string;
  name: string;
  slug: string;
  description: string;
  template: string;
  folders: Array<{
    id: string;
    name: string;
    parentId: string | null;
    createdAt: number;
  }>;
  files: Array<{
    id: string;
    name: string;
    language:
      | "compact"
      | "markdown"
      | "json"
      | "javascript"
      | "typescript"
      | "yaml"
      | "text";
    content: string;
    folderId?: string | null;
    createdAt: number;
    updatedAt: number;
  }>;
  activeFileId: string;
  artifactBaseUrl: string | null;
  compiledSourceHash: string | null;
  contractAddress: string | null;
  deployTxHash: string | null;
  deployBlockNumber: number | null;
  deployResult: unknown | null;
  witnessValues: Record<string, string>;
  constructorValues: Record<string, string>;
  compileResult: unknown | null;
  createdAt: number;
  updatedAt: number;
};

export type CloudProjectUpsert = {
  id?: string;
  name: string;
  slug?: string;
  description?: string;
  template?: string;
  folders: CloudProject["folders"];
  files: CloudProject["files"];
  activeFileId: string;
  artifactBaseUrl?: string | null;
  compiledSourceHash?: string | null;
  contractAddress?: string | null;
  deployTxHash?: string | null;
  deployBlockNumber?: number | null;
  deployResult?: unknown | null;
  witnessValues?: Record<string, string>;
  constructorValues?: Record<string, string>;
  compileResult?: unknown | null;
};

export type CloudProjectPatch = Partial<{
  name: string;
  slug: string;
  description: string;
  folders: CloudProject["folders"];
  files: CloudProject["files"];
  activeFileId: string;
  artifactBaseUrl: string | null;
  compiledSourceHash: string | null;
  witnessValues: Record<string, string> | null;
  constructorValues: Record<string, string> | null;
  compileResult: unknown | null;
  contractAddress: string | null;
  deployTxHash: string | null;
  deployBlockNumber: number | null;
  deployResult: unknown | null;
}>;

export async function apiFetch(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.json !== undefined) headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(`${API_BASE.replace(/\/$/, "")}${path}`, {
    ...init,
    headers,
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
    credentials: "include",
  });
}
