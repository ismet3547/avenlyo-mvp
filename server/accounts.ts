import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { promisify } from "node:util";
import { transaction } from "./store.js";
import { HttpError, text } from "./validation.js";

export const sessionLifetime = 7 * 24 * 60 * 60 * 1000;
export const tokenPattern = /^[A-Za-z0-9_-]{43}$/;

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: string,
  length: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

export type Account = { id: string; email: string };
type Credentials = Account & { password: string };

export function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function token() {
  return randomBytes(32).toString("base64url");
}

export function emailInput(value: unknown, required = true) {
  const email = text(value, "E-posta", 254, required).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new HttpError(400, "Geçerli bir e-posta adresi girin.");
  return email;
}

export function passwordInput(value: unknown) {
  if (typeof value !== "string" || value.length < 12 || value.length > 128)
    throw new HttpError(400, "Şifre 12–128 karakter arasında olmalıdır.");
  return value;
}

function derive(password: string, salt: string) {
  return scryptAsync(password, salt, 64, {
    N: 2 ** 15,
    r: 8,
    p: 3,
    maxmem: 64 * 1024 * 1024,
  });
}

async function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + (await derive(password, salt)).toString("hex");
}

export class Accounts {
  private db: DatabaseSync;

  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    this.db
      .exec(`PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL, recovery_hash TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS sessions_account ON sessions(account_id);`);
  }

  async create(email: string, password: string) {
    const account = { id: randomBytes(16).toString("hex"), email };
    const recoveryCode = token();
    const passwordValue = await passwordHash(password);
    return transaction(this.db, () => {
      const inserted = this.db
        .prepare(
          "INSERT INTO accounts VALUES(?,?,?,?) ON CONFLICT(email) DO NOTHING",
        )
        .run(account.id, email, passwordValue, digest(recoveryCode));
      if (!inserted.changes)
        throw new HttpError(409, "Bu e-posta ile bir hesap zaten kayıtlı.");
      return { account, recoveryCode, session: this.startSession(account.id) };
    });
  }

  async login(email: string, password: string) {
    const row = this.db
      .prepare("SELECT id, email, password FROM accounts WHERE email = ?")
      .get(email) as Credentials | undefined;
    const [salt, expected] = (
      row?.password ?? "0".repeat(32) + ":" + "0".repeat(128)
    ).split(":");
    const matches = timingSafeEqual(
      await derive(password, salt),
      Buffer.from(expected, "hex"),
    );
    if (!row || !matches)
      throw new HttpError(401, "E-posta veya şifre hatalı.");
    return transaction(this.db, () => {
      // A simultaneous password reset revokes the password this request checked.
      if (
        !this.db
          .prepare("SELECT 1 FROM accounts WHERE id = ? AND password = ?")
          .get(row.id, row.password)
      )
        throw new HttpError(401, "E-posta veya şifre hatalı.");
      return {
        account: { id: row.id, email: row.email },
        session: this.startSession(row.id),
      };
    });
  }

  async reset(email: string, code: string, password: string) {
    const previous = digest(code);
    const account = this.db
      .prepare(
        "SELECT id, email FROM accounts WHERE email = ? AND recovery_hash = ?",
      )
      .get(email, previous) as Account | undefined;
    if (!account)
      throw new HttpError(401, "E-posta veya kurtarma kodu hatalı.");
    const recoveryCode = token();
    const newPassword = await passwordHash(password);
    return transaction(this.db, () => {
      const changed = this.db
        .prepare(
          "UPDATE accounts SET password = ?, recovery_hash = ? WHERE id = ? AND recovery_hash = ?",
        )
        .run(newPassword, digest(recoveryCode), account.id, previous);
      if (!changed.changes) throw new HttpError(401, "Kurtarma kodu geçersiz.");
      this.db
        .prepare("DELETE FROM sessions WHERE account_id = ?")
        .run(account.id);
      return { account, recoveryCode, session: this.startSession(account.id) };
    });
  }

  rotateRecovery(id: string) {
    const code = token();
    this.db
      .prepare("UPDATE accounts SET recovery_hash = ? WHERE id = ?")
      .run(digest(code), id);
    return code;
  }

  startSession(id: string) {
    const session = token();
    const now = Date.now();
    this.db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now);
    this.db
      .prepare("INSERT INTO sessions VALUES(?,?,?)")
      .run(digest(session), id, now + sessionLifetime);
    return session;
  }

  session(session: string) {
    if (!tokenPattern.test(session)) return undefined;
    return this.db
      .prepare(
        `SELECT a.id, a.email FROM accounts a JOIN sessions s ON s.account_id = a.id
        WHERE s.token_hash = ? AND s.expires_at > ?`,
      )
      .get(digest(session), Date.now()) as Account | undefined;
  }

  endSession(session: string) {
    if (tokenPattern.test(session))
      this.db
        .prepare("DELETE FROM sessions WHERE token_hash = ?")
        .run(digest(session));
  }

  exists(id: string) {
    return Boolean(
      this.db.prepare("SELECT 1 FROM accounts WHERE id = ?").get(id),
    );
  }

  close() {
    this.db.close();
  }
}
