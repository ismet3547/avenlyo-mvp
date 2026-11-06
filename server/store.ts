import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import type {
  Agent,
  Business,
  Conversation,
  Message,
  Source,
} from "../shared.js";

export const starterAgents = [
  {
    name: "Müşteri Destek",
    description:
      "Müşterilerinizin sorularını yanıtlayan, çözüm odaklı yardımcınız.",
    icon: "headphones",
    color: "purple",
    instructions:
      "Müşteri destek uzmanı olarak nazik, net ve çözüm odaklı yanıt ver. İşletme bilgilerinde olmayan iade, teslimat veya fiyat bilgilerini uydurma. Gerektiğinde kullanıcıdan ayrıntı iste.",
  },
  {
    name: "İçerik Editörü",
    description: "Markanızın sesini anlayan, yaratıcı içerik ortağınız.",
    icon: "pen",
    color: "orange",
    instructions:
      "İşletmenin hedef kitlesine ve marka diline uygun özgün içerikler üret. Kanal, amaç veya format belirsizse kısa bir soru sor. Doğrulanmamış ürün iddiaları oluşturma.",
  },
  {
    name: "Satış Danışmanı",
    description:
      "Ürünlerinizi tanıtan, doğru sorularla fırsatları keşfeden ajanınız.",
    icon: "trend",
    color: "green",
    instructions:
      "İşletmenin ürün ve hizmetlerini kullanıcının ihtiyacına göre öner. Fiyat, indirim ve stok bilgilerini yalnızca verilen kaynaklardan aktar. Kesin satış veya gelir vaatlerinde bulunma.",
  },
];

export function transaction<T>(db: DatabaseSync, run: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = run();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export class Store {
  db: DatabaseSync;
  constructor(path: string, seedLocalWorkspace = true) {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    this.db
      .exec(`PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS records (kind TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY(kind,id));
      CREATE TABLE IF NOT EXISTS conversations (id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, title TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE, role TEXT NOT NULL CHECK(role IN ('user','assistant')), content TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS messages_conversation ON messages(conversation_id,created_at);`);
    if (seedLocalWorkspace && !this.get("meta", "initialized")) {
      this.db.exec("BEGIN");
      try {
        this.set("business", "profile", {
          name: "",
          industry: "",
          description: "",
          audience: "",
          products: "",
          tone: "Samimi ve profesyonel",
          website: "",
        });
        for (const template of starterAgents) {
          const now = new Date().toISOString();
          this.set("agent", randomUUID(), {
            ...template,
            model: "",
            sourceIds: [],
            active: true,
            createdAt: now,
            updatedAt: now,
          });
        }
        this.set("meta", "initialized", true);
        this.db.exec("COMMIT");
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
    }
  }
  get<T>(kind: string, id: string): T | undefined {
    const row = this.db
      .prepare("SELECT data FROM records WHERE kind = ? AND id = ?")
      .get(kind, id) as { data: string } | undefined;
    return row ? JSON.parse(row.data) : undefined;
  }
  set<T>(kind: string, id: string, data: T) {
    const value =
      typeof data === "object" && data !== null && !Array.isArray(data)
        ? { ...data, ...(kind === "agent" || kind === "source" ? { id } : {}) }
        : data;
    this.db
      .prepare(
        "INSERT INTO records(kind,id,data) VALUES(?,?,?) ON CONFLICT(kind,id) DO UPDATE SET data=excluded.data",
      )
      .run(kind, id, JSON.stringify(value));
    return value as T;
  }
  list<T>(kind: string): T[] {
    return (
      this.db
        .prepare("SELECT data FROM records WHERE kind = ? ORDER BY rowid")
        .all(kind) as { data: string }[]
    ).map((row) => JSON.parse(row.data));
  }
  remove(kind: string, id: string) {
    this.db
      .prepare("DELETE FROM records WHERE kind = ? AND id = ?")
      .run(kind, id);
  }
  business() {
    return this.get<Business>("business", "profile")!;
  }
  agents() {
    return this.list<Agent>("agent");
  }
  sources() {
    return this.list<Source>("source");
  }
  conversations() {
    return this.db
      .prepare(
        "SELECT id, agent_id AS agentId, title, created_at AS createdAt, updated_at AS updatedAt FROM conversations ORDER BY updated_at DESC",
      )
      .all() as unknown as Conversation[];
  }
  conversation(id: string) {
    return this.db
      .prepare(
        "SELECT id, agent_id AS agentId, title, created_at AS createdAt, updated_at AS updatedAt FROM conversations WHERE id = ?",
      )
      .get(id) as unknown as Conversation | undefined;
  }
  createConversation(agentId: string, title: string) {
    const id = randomUUID(),
      now = new Date().toISOString();
    this.db
      .prepare("INSERT INTO conversations VALUES(?,?,?,?,?)")
      .run(id, agentId, title, now, now);
    return this.conversation(id)!;
  }
  messages(id: string) {
    return this.db
      .prepare(
        "SELECT id, conversation_id AS conversationId, role, content, created_at AS createdAt FROM messages WHERE conversation_id = ? ORDER BY rowid",
      )
      .all(id) as unknown as Message[];
  }
  recentMessages(id: string, limit: number) {
    return (
      this.db
        .prepare(
          "SELECT id, conversation_id AS conversationId, role, content, created_at AS createdAt FROM messages WHERE conversation_id = ? ORDER BY rowid DESC LIMIT ?",
        )
        .all(id, limit) as unknown as Message[]
    ).reverse();
  }
  addMessage(conversationId: string, role: Message["role"], content: string) {
    const id = randomUUID(),
      now = new Date().toISOString();
    this.db
      .prepare("INSERT INTO messages VALUES(?,?,?,?,?)")
      .run(id, conversationId, role, content, now);
    this.db
      .prepare("UPDATE conversations SET updated_at = ? WHERE id = ?")
      .run(now, conversationId);
    return { id, conversationId, role, content, createdAt: now };
  }
  removeConversation(id: string) {
    this.db.prepare("DELETE FROM conversations WHERE id = ?").run(id);
  }
  removeAgent(id: string) {
    this.db.exec("BEGIN");
    try {
      this.db.prepare("DELETE FROM conversations WHERE agent_id = ?").run(id);
      this.remove("agent", id);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  removeSource(id: string) {
    this.db.exec("BEGIN");
    try {
      this.remove("source", id);
      for (const agent of this.agents())
        if (agent.sourceIds.includes(id))
          this.set("agent", agent.id, {
            ...agent,
            sourceIds: agent.sourceIds.filter((s) => s !== id),
          });
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  close() {
    this.db.close();
  }
}
