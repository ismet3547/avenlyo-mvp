export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch("/api" + path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiError(
      response.status,
      body?.error || "İşlem tamamlanamadı. Lütfen tekrar deneyin.",
    );
  if (body === null)
    throw new ApiError(
      response.status,
      "Sunucudan geçerli bir yanıt alınamadı.",
    );
  return body as T;
}

export const json = (value: unknown) => JSON.stringify(value);
