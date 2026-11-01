export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const body = await response.json();
  if (!response.ok)
    throw new Error(
      body.error || "İşlem tamamlanamadı. Lütfen tekrar deneyin.",
    );
  return body as T;
}
export const json = (value: unknown) => JSON.stringify(value);
