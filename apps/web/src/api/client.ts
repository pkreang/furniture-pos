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
  const res = await fetch(path, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return parse<T>(res, path);
}
