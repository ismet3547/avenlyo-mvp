export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new HttpError(400, "Geçerli bir veri gönderin.");
  return value as Record<string, unknown>;
}
export function text(
  value: unknown,
  label: string,
  max: number,
  required = false,
): string {
  if (value === undefined && !required) return "";
  if (typeof value !== "string")
    throw new HttpError(400, `${label} metin olmalıdır.`);
  const result = value.trim();
  if (required && !result) throw new HttpError(400, `${label} gereklidir.`);
  if (result.length > max)
    throw new HttpError(400, `${label} en fazla ${max} karakter olabilir.`);
  return result;
}
export function modelName(value: unknown, required = false) {
  const result = text(value, "Model", 100, required);
  if (result && !/^[a-zA-Z0-9._:-]+$/.test(result))
    throw new HttpError(400, "Geçerli bir OpenAI model kimliği girin.");
  return result;
}
export function agentInput(input: unknown) {
  const b = object(input);
  if (
    !Array.isArray(b.sourceIds) ||
    b.sourceIds.length > 50 ||
    b.sourceIds.some((id) => typeof id !== "string")
  )
    throw new HttpError(400, "Kaynak seçimi geçersiz.");
  if (typeof b.active !== "boolean")
    throw new HttpError(400, "Ajan durumu geçersiz.");
  return {
    name: text(b.name, "Ajan adı", 60, true),
    description: text(b.description, "Açıklama", 180),
    instructions: text(b.instructions, "Talimatlar", 12000, true),
    icon: [
      "headphones",
      "pen",
      "trend",
      "bot",
      "sparkles",
      "briefcase",
    ].includes(String(b.icon))
      ? String(b.icon)
      : "bot",
    color: ["purple", "orange", "green", "blue", "pink"].includes(
      String(b.color),
    )
      ? String(b.color)
      : "purple",
    model: modelName(b.model),
    sourceIds: [...new Set(b.sourceIds as string[])],
    active: b.active,
  };
}
export function sourceInput(input: unknown) {
  const b = object(input);
  return {
    title: text(b.title, "Kaynak adı", 100, true),
    content: text(b.content, "İçerik", 30000, true),
    category: text(b.category, "Kategori", 60, true),
  };
}
export function businessInput(input: unknown) {
  const b = object(input);
  const website = text(b.website, "Web sitesi", 300);
  if (website) {
    try {
      const url = new URL(website);
      if (!["https:", "http:"].includes(url.protocol)) throw new Error();
    } catch {
      throw new HttpError(400, "Geçerli bir web sitesi adresi girin.");
    }
  }
  return {
    name: text(b.name, "İşletme adı", 100, true),
    industry: text(b.industry, "Sektör", 100),
    description: text(b.description, "İşletme açıklaması", 12000, true),
    audience: text(b.audience, "Hedef kitle", 4000),
    products: text(b.products, "Ürünler", 12000),
    tone: text(b.tone, "Marka dili", 100),
    website,
  };
}
export function settingsInput(input: unknown) {
  const b = object(input);
  const apiKey =
    b.apiKey === undefined
      ? undefined
      : text(b.apiKey, "API anahtarı", 512, true);
  if (apiKey && (!apiKey.startsWith("sk-") || apiKey.length < 15))
    throw new HttpError(400, "Geçerli bir OpenAI API anahtarı girin.");
  return { apiKey, model: modelName(b.model, true) };
}
