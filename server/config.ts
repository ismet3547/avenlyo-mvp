import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  renameSync,
} from "node:fs";
import { join } from "node:path";
import { HttpError } from "./validation.js";

export class Config {
  private file: string;
  private local: { apiKey?: string; model?: string } = {};
  constructor(
    dataDir: string,
    private env: NodeJS.ProcessEnv = process.env,
  ) {
    mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    this.file = join(dataDir, "settings.json");
    if (existsSync(this.file))
      this.local = JSON.parse(readFileSync(this.file, "utf8"));
  }
  key() {
    return this.env.OPENAI_API_KEY || this.local.apiKey || "";
  }
  model() {
    return this.local.model || this.env.OPENAI_MODEL || "gpt-4.1-mini";
  }
  public() {
    return {
      configured: Boolean(this.key()),
      keySource: this.env.OPENAI_API_KEY
        ? ("environment" as const)
        : this.local.apiKey
          ? ("local" as const)
          : ("none" as const),
      model: this.model(),
    };
  }
  save({ apiKey, model }: { apiKey?: string; model: string }) {
    if (apiKey && this.env.OPENAI_API_KEY)
      throw new HttpError(
        400,
        "Ortam değişkeninde bir anahtar tanımlı. Anahtarı değiştirmek için .env dosyasını güncelleyip uygulamayı yeniden başlatın.",
      );
    const next = { ...this.local, model, ...(apiKey ? { apiKey } : {}) };
    writeFileSync(this.file + ".tmp", JSON.stringify(next, null, 2), {
      mode: 0o600,
    });
    renameSync(this.file + ".tmp", this.file);
    this.local = next;
    return this.public();
  }
}
