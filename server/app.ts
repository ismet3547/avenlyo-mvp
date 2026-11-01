import express from "express";
import { randomUUID } from "node:crypto";
import type { Agent, Source } from "../shared.js";
import { Store } from "./store.js";
import { Config } from "./config.js";
import {
  OpenAIProvider,
  instructionsFor,
  providerError,
  type Provider,
} from "./provider.js";
import {
  agentInput,
  businessInput,
  HttpError,
  object,
  settingsInput,
  sourceInput,
  text,
} from "./validation.js";

export function createApp(
  store: Store,
  config: Config,
  provider: Provider = new OpenAIProvider(),
) {
  const app = express();
  app.disable("x-powered-by");
  const running = new Set<string>();
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("X-Frame-Options", "DENY");
    next();
  });
  app.use("/api", (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    let host = "";
    try {
      host = new URL(`http://${req.get("host") || ""}`).hostname;
    } catch {
      return next(new HttpError(403, "Geçersiz sunucu adresi."));
    }
    const allowed = [
      "localhost",
      "127.0.0.1",
      "[::1]",
      ...(process.env.AVENLYO_ALLOWED_HOSTS || "")
        .split(",")
        .map((h) => h.trim())
        .filter(Boolean),
    ];
    if (!allowed.includes(host))
      return next(
        new HttpError(
          403,
          "Bu sunucu adresine izin verilmiyor. Yerel adresi kullanın.",
        ),
      );
    const origin = req.get("origin");
    if (origin) {
      try {
        if (new URL(origin).host !== req.get("host")) throw new Error();
      } catch {
        return next(new HttpError(403, "Bu kaynaktan istek kabul edilmiyor."));
      }
    }
    if (req.get("sec-fetch-site") === "cross-site")
      return next(new HttpError(403, "Siteler arası isteğe izin verilmiyor."));
    next();
  });
  app.use(express.json({ limit: "1mb" }));
  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.get("/api/state", (_req, res) =>
    res.json({
      agents: store.agents(),
      sources: store.sources(),
      business: store.business(),
      conversations: store.conversations(),
      settings: config.public(),
    }),
  );
  function checkSources(ids: string[]) {
    if (ids.some((id) => !store.get("source", id)))
      throw new HttpError(400, "Seçili kaynaklardan biri artık mevcut değil.");
  }
  app.post("/api/agents", (req, res) => {
    const data = agentInput(req.body);
    checkSources(data.sourceIds);
    const now = new Date().toISOString();
    res.status(201).json(
      store.set("agent", randomUUID(), {
        ...data,
        createdAt: now,
        updatedAt: now,
      }),
    );
  });
  app.put("/api/agents/:id", (req, res) => {
    const old = store.get<Agent>("agent", req.params.id);
    if (!old) throw new HttpError(404, "Ajan bulunamadı.");
    if ([...running].some((id) => store.conversation(id)?.agentId === old.id))
      throw new HttpError(
        409,
        "Yanıt oluşturulurken ajan düzenlenemez. Önce yanıtı durdurun.",
      );
    const data = agentInput(req.body);
    checkSources(data.sourceIds);
    res.json(
      store.set("agent", old.id, {
        ...old,
        ...data,
        updatedAt: new Date().toISOString(),
      }),
    );
  });
  app.delete("/api/agents/:id", (req, res) => {
    if (!store.get("agent", req.params.id))
      throw new HttpError(404, "Ajan bulunamadı.");
    if (
      [...running].some(
        (id) => store.conversation(id)?.agentId === req.params.id,
      )
    )
      throw new HttpError(409, "Önce ajanın devam eden yanıtını durdurun.");
    store.removeAgent(req.params.id);
    res.json({ ok: true });
  });
  app.post("/api/sources", (req, res) => {
    const data = sourceInput(req.body);
    const now = new Date().toISOString();
    res.status(201).json(
      store.set("source", randomUUID(), {
        ...data,
        createdAt: now,
        updatedAt: now,
      }),
    );
  });
  app.put("/api/sources/:id", (req, res) => {
    const old = store.get<Source>("source", req.params.id);
    if (!old) throw new HttpError(404, "Kaynak bulunamadı.");
    res.json(
      store.set("source", old.id, {
        ...old,
        ...sourceInput(req.body),
        updatedAt: new Date().toISOString(),
      }),
    );
  });
  app.delete("/api/sources/:id", (req, res) => {
    if (!store.get("source", req.params.id))
      throw new HttpError(404, "Kaynak bulunamadı.");
    store.removeSource(req.params.id);
    res.json({ ok: true });
  });
  app.put("/api/business", (req, res) =>
    res.json(store.set("business", "profile", businessInput(req.body))),
  );
  app.put("/api/settings", (req, res) =>
    res.json(config.save(settingsInput(req.body))),
  );
  app.post("/api/settings/test", async (req, res) => {
    const data = settingsInput(req.body);
    const key = data.apiKey || config.key();
    if (!key) throw new HttpError(400, "Önce bir OpenAI API anahtarı girin.");
    await provider.test(key, data.model);
    res.json({ ok: true });
  });
  app.get("/api/export", (_req, res) =>
    res.json({
      version: 1,
      exportedAt: new Date().toISOString(),
      business: store.business(),
      agents: store.agents(),
      sources: store.sources(),
      conversations: store
        .conversations()
        .map((c) => ({ ...c, messages: store.messages(c.id) })),
    }),
  );
  app.get("/api/conversations/:id/messages", (req, res) => {
    if (!store.conversation(req.params.id))
      throw new HttpError(404, "Sohbet bulunamadı.");
    res.json(store.messages(req.params.id));
  });
  app.delete("/api/conversations/:id", (req, res) => {
    if (running.has(req.params.id))
      throw new HttpError(409, "Önce yanıtı durdurun.");
    if (!store.conversation(req.params.id))
      throw new HttpError(404, "Sohbet bulunamadı.");
    store.removeConversation(req.params.id);
    res.json({ ok: true });
  });
  app.post("/api/chat", async (req, res) => {
    const body = object(req.body),
      agentId = text(body.agentId, "Ajan", 100, true),
      content = text(body.content, "Mesaj", 8000, true);
    const agent = store.get<Agent>("agent", agentId);
    if (!agent) throw new HttpError(404, "Ajan bulunamadı.");
    if (!agent.active)
      throw new HttpError(
        400,
        "Bu ajan duraklatılmış. Ajan ayarlarından etkinleştirin.",
      );
    if (!config.key())
      throw new HttpError(
        400,
        "Sohbete başlamak için Ayarlar’dan OpenAI API anahtarınızı ekleyin.",
      );
    const conversationId = text(body.conversationId, "Sohbet", 100);
    let conversation = conversationId
      ? store.conversation(conversationId)
      : undefined;
    if (conversationId && !conversation)
      throw new HttpError(404, "Sohbet bulunamadı.");
    if (conversation && conversation.agentId !== agent.id)
      throw new HttpError(400, "Bu sohbet başka bir ajana ait.");
    if (conversation && running.has(conversation.id))
      throw new HttpError(
        409,
        "Bu sohbette hâlihazırda bir yanıt hazırlanıyor.",
      );
    const sources = store
        .sources()
        .filter((s) => agent.sourceIds.includes(s.id)),
      business = store.business();
    instructionsFor(agent, business, sources);
    // Keep recent complete turns inside a bounded context; all messages remain in SQLite.
    const history = conversation ? store.messages(conversation.id) : [];
    const recent: typeof history = [];
    let chars = content.length;
    for (let i = history.length - 1; i >= 0; i--) {
      if (chars + history[i].content.length > 40000 || recent.length >= 20)
        break;
      recent.unshift(history[i]);
      chars += history[i].content.length;
    }
    if (recent[0]?.role === "assistant") recent.shift();
    if (!conversation)
      conversation = store.createConversation(agent.id, content.slice(0, 70));
    const id = conversation.id;
    running.add(id);
    const controller = new AbortController();
    res.on("close", () => {
      if (!res.writableEnded) controller.abort();
    });
    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    const send = (value: unknown) => {
      if (!res.destroyed) res.write(JSON.stringify(value) + "\n");
    };
    send({ type: "conversation", conversation });
    try {
      const result = await provider.generate({
        apiKey: config.key(),
        model: agent.model || config.model(),
        agent,
        business,
        sources,
        messages: [...recent, { role: "user", content }],
        signal: controller.signal,
        onDelta: (delta) => send({ type: "delta", delta }),
      });
      if (controller.signal.aborted)
        throw new HttpError(499, "Yanıt durduruldu.");
      store.db.exec("BEGIN");
      let user, assistant;
      try {
        user = store.addMessage(id, "user", content);
        assistant = store.addMessage(id, "assistant", result);
        store.db.exec("COMMIT");
      } catch (e) {
        store.db.exec("ROLLBACK");
        throw e;
      }
      send({ type: "done", messages: [user, assistant] });
    } catch (e) {
      send({ type: "error", error: providerError(e).message });
      if (!history.length) store.removeConversation(id);
    } finally {
      running.delete(id);
      res.end();
    }
  });
  app.use("/api", (_req, _res, next) =>
    next(new HttpError(404, "İşlem bulunamadı.")),
  );
  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      const typed = error as { type?: string };
      const status =
        error instanceof HttpError
          ? error.status
          : typed.type === "entity.too.large"
            ? 413
            : error instanceof SyntaxError
              ? 400
              : 500;
      res.status(status).json({
        error:
          error instanceof HttpError
            ? error.message
            : status === 413
              ? "Gönderilen veri çok büyük."
              : status === 400
                ? "Geçersiz JSON verisi."
                : "İşlem tamamlanamadı. Lütfen tekrar deneyin.",
      });
    },
  );
  return app;
}
