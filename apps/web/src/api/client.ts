export interface ApiError {
  code: string;
  message: string;
}

async function parse<T>(res: Response, path: string): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiError | null;
    const err = new Error(body?.message ?? `API ${path} failed with ${res.status}`);
    (err as Error & { code?: string; status: number }).status = res.status;
    (err as Error & { code?: string }).code = body?.code;
    throw err;
  }
  return res.json() as Promise<T>;
}

export async function apiGet<T>(path: string): Promise<T> {
  return parse<T>(await fetch(path, { credentials: "include" }), path);
}

export async function apiSend<T>(
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  // Only attach Content-Type when we actually have a JSON body — Fastify's
  // body parser rejects empty bodies with status 400 if Content-Type is set
  // to application/json. This bit endpoints like /auth/logout and the SO
  // status-transition POSTs that intentionally have no body.
  const init: RequestInit = { method, credentials: "include" };
  if (body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }
  return parse<T>(await fetch(path, init), path);
}
