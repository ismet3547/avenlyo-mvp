import express, { type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import type {
  AccountCreated,
  Answer,
  CustomerAgent,
  Handoff,
  InboxItem,
  InboxThread,
  PreviewAnswer,
  Publication,
  WorkspaceProfile,
  WorkspaceSource,
  WorkspaceState,
} from "../shared.js";
import {
  Accounts,
  digest,
  emailInput,
  passwordInput,
  sessionLifetime,
  tokenPattern,
  type Account,
} from "./accounts.js";
import { answerQuestion, demoProfile, demoSources } from "./answers.js";
import { OpenAIProvider, type Provider } from "./provider.js";
import { Store, transaction } from "./store.js";
import { HttpError, object, sourceInput, text } from "./validation.js";

const sessionCookie = "avenlyo_a1";
const supportAgentId = "support";
const profileKey = "workspace";
const publicationKey = "support";
const localHosts = ["localhost", "127.0.0.1", "[::1]"];
const localAddresses = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

type Snapshot = {
  profile: WorkspaceProfile;
  sources: WorkspaceSource[];
  revision: string;
};
type Published = Snapshot & Publication;
type Visitor = { conversationId: string };
type SavedAnswer = Answer & { question: string };

function profileInput(value: unknown): WorkspaceProfile {
  const b = object(value);
  return {
    businessName: text(b.businessName, "İşletme adı", 100, true),
    agentName: text(b.agentName, "Ajan adı", 60, true),
    description: text(b.description, "İşletme açıklaması", 3000),
    tone: text(b.tone, "Yanıt tonu", 100, true),
    contactEmail: emailInput(b.contactEmail, false),
  };
}

function knowledgeInput(value: unknown) {
  const b = object(value);
  const question = text(b.question, "Soru", 300);
  if (typeof b.approved !== "boolean")
    throw new HttpError(400, "Kaynağın onay durumunu seçin.");
  return {
    ...sourceInput({
      ...b,
      category: question ? "Sık sorulan sorular" : "Metin",
    }),
    question,
    approved: b.approved,
  };
}

function snapshot(
  profile: WorkspaceProfile,
  sources: WorkspaceSource[],
): Snapshot {
  const approved = sources.filter((source) => source.approved);
  const content = approved.map(({ id, title, question, content }) => ({
    id,
    title,
    question,
    content,
  }));
  return {
    profile,
    sources: approved,
    revision: digest(JSON.stringify([profile, content])),
  };
}

function draft(store: Store) {
  const profile = store.get<WorkspaceProfile>("profile", profileKey);
  if (!profile) throw new HttpError(400, "Önce ajan bilgilerini kaydedin.");
  return snapshot(profile, store.list<WorkspaceSource>("source"));
}

function readPublication(store: Store) {
  return store.get<Published>("publication", publicationKey);
}

function publicationInfo(value: Published | undefined): Publication | null {
  if (!value) return null;
  const { slug, status, publishedAt } = value;
  return { slug, status, publishedAt };
}

function workspaceState(
  store: Store,
  modelConfigured: boolean,
): WorkspaceState {
  const profile = store.get<WorkspaceProfile>("profile", profileKey) ?? null;
  const sources = store.list<WorkspaceSource>("source");
  const publication = readPublication(store);
  const current = profile && snapshot(profile, sources);
  return {
    profile,
    sources,
    publication: publicationInfo(publication),
    tested: Boolean(current && store.get("preview", current.revision)),
    modelConfigured,
    unpublishedChanges: Boolean(
      publication && current?.revision !== publication.revision,
    ),
  };
}

function slugFor(businessName: string, workspaceId: string) {
  const prefix = businessName
    .toLocaleLowerCase("tr")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 48)
    .replace(/^-|-$/g, "");
  return (prefix || "isletme") + "-" + workspaceId;
}

function tokenInput(value: unknown, label: string) {
  const token = text(value, label, 43, true);
  if (!tokenPattern.test(token)) throw new HttpError(400, label + " geçersiz.");
  return token;
}

function cookieToken(req: Request) {
  return (
    req.headers.cookie?.match(
      /(?:^|;\s*)avenlyo_a1=([A-Za-z0-9_-]{43})(?:;|$)/,
    )?.[1] ?? ""
  );
}

function cookieOptions(req: Request) {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: req.secure,
    path: "/",
  };
}

function rateLimit(max: number, period: number) {
  const hits = new Map<string, number>();
  let resetAt = 0;
  return (key: string) => {
    if (Date.now() >= resetAt) {
      hits.clear();
      resetAt = Date.now() + period;
    }
    const count = (hits.get(key) ?? 0) + 1;
    if (count > max)
      throw new HttpError(
        429,
        "Çok fazla istek gönderildi. Bir süre sonra tekrar deneyin.",
      );
    hits.set(key, count);
  };
}

function customerAgent(
  current: Snapshot,
  status: CustomerAgent["status"],
): CustomerAgent {
  return {
    businessName: current.profile.businessName,
    agentName: current.profile.agentName,
    contactEmail: status === "paused" ? current.profile.contactEmail : "",
    status,
    suggestions:
      status === "paused"
        ? []
        : [
            ...new Set(
              current.sources.map((source) => source.question).filter(Boolean),
            ),
          ].slice(0, 3),
  };
}

function customerAnswer(result: PreviewAnswer): Answer {
  return { text: result.text, handoff: result.handoff };
}

function clientSignal(res: Response) {
  const controller = new AbortController();
  res.once("close", () => {
    if (!res.writableEnded) controller.abort();
  });
  return controller.signal;
}

function previousAnswer(
  store: Store,
  id: string,
  question: string,
): Answer | undefined {
  const previous = store.get<SavedAnswer>("turn", id);
  if (!previous) return undefined;
  if (previous.question !== question)
    throw new HttpError(409, "Bu mesaj kimliği zaten kullanıldı.");
  return { text: previous.text, handoff: previous.handoff };
}

function conversationFor(store: Store, visitorId: string, subject: string) {
  const previous = store.get<Visitor>("visitor", visitorId);
  if (previous && store.conversation(previous.conversationId))
    return previous.conversationId;
  const conversation = store.createConversation(
    supportAgentId,
    subject.slice(0, 70),
  );
  store.set("visitor", visitorId, { conversationId: conversation.id });
  return conversation.id;
}

export function createA1App(
  dataDir: string,
  env: NodeJS.ProcessEnv = process.env,
  provider: Provider = new OpenAIProvider(),
) {
  const app = express();
  const accounts = new Accounts(join(dataDir, "accounts.sqlite"));
  const allowedHosts = new Set([
    ...localHosts,
    ...(env.AVENLYO_ALLOWED_HOSTS ?? "")
      .split(",")
      .map((host) => host.trim())
      .filter(Boolean),
  ]);
  const authLimit = rateLimit(35, 15 * 60 * 1000);
  const chatLimit = rateLimit(90, 60 * 1000);
  const activeRequests = new Set<string>();
  const demo = snapshot(demoProfile, demoSources);
  const modelConfigured = Boolean(env.OPENAI_API_KEY?.trim());
  app.disable("x-powered-by");

  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    if (/^\/gomme\/[a-z0-9-]+\/?$/.test(req.path)) {
      res.setHeader(
        "Content-Security-Policy",
        "frame-ancestors 'self' http://localhost:* http://127.0.0.1:*",
      );
    } else {
      res.setHeader("X-Frame-Options", "DENY");
    }
    const host = req.get("host") ?? "";
    try {
      const parsed = new URL("http://" + host);
      if (
        !localAddresses.has(req.socket.remoteAddress ?? "") ||
        !allowedHosts.has(parsed.hostname) ||
        parsed.username ||
        parsed.password ||
        parsed.pathname !== "/" ||
        parsed.search ||
        parsed.hash
      )
        throw new Error();
    } catch {
      return next(
        new HttpError(
          403,
          "Avenlyo kapalı test ortamı yalnızca yerel erişime açıktır.",
        ),
      );
    }
    next();
  });

  app.use("/api", (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    const origin = req.get("origin");
    try {
      if (origin) {
        const parsed = new URL(origin);
        if (
          !["http:", "https:"].includes(parsed.protocol) ||
          parsed.host !== req.get("host")
        )
          throw new Error();
      }
      if (req.get("sec-fetch-site") === "cross-site") throw new Error();
    } catch {
      return next(new HttpError(403, "Bu kaynaktan istek kabul edilmiyor."));
    }
    next();
  });
  app.use("/api", express.json({ limit: "512kb" }));
  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  function requireAccount(req: Request) {
    const account = accounts.session(cookieToken(req));
    if (!account) throw new HttpError(401, "Devam etmek için giriş yapın.");
    return account;
  }

  function openWorkspace(id: string) {
    return new Store(
      join(dataDir, "workspaces", id, "workspace.sqlite"),
      false,
    );
  }

  function owner(
    handler: (
      store: Store,
      req: Request,
      res: Response,
      account: Account,
    ) => void | Promise<void>,
  ) {
    return async (req: Request, res: Response) => {
      const account = requireAccount(req);
      const store = openWorkspace(account.id);
      try {
        await handler(store, req, res, account);
      } finally {
        store.close();
      }
    };
  }

  function visitor(
    handler: (
      store: Store,
      publication: Published,
      req: Request,
      res: Response,
    ) => void | Promise<void>,
  ) {
    return async (req: Request, res: Response) => {
      const slug = req.params.slug;
      const id =
        typeof slug === "string"
          ? /^[a-z0-9-]{1,48}-([a-f0-9]{32})$/.exec(slug)?.[1]
          : undefined;
      if (!id || !accounts.exists(id))
        throw new HttpError(404, "Bu sohbet bağlantısı bulunamadı.");
      const store = openWorkspace(id);
      try {
        const publication = readPublication(store);
        if (!publication || publication.slug !== slug)
          throw new HttpError(404, "Bu sohbet bağlantısı bulunamadı.");
        await handler(store, publication, req, res);
      } finally {
        store.close();
      }
    };
  }

  function setSession(req: Request, res: Response, session: string) {
    accounts.endSession(cookieToken(req));
    res.cookie(sessionCookie, session, {
      ...cookieOptions(req),
      maxAge: sessionLifetime,
    });
  }

  function answer(
    current: Snapshot,
    question: string,
    signal: AbortSignal,
    history?: Parameters<typeof answerQuestion>[3]["history"],
    useModel = true,
  ) {
    return answerQuestion(current.profile, current.sources, question, {
      provider,
      apiKey: useModel ? (env.OPENAI_API_KEY?.trim() ?? "") : "",
      model: env.OPENAI_MODEL || "gpt-4.1-mini",
      signal,
      history,
    });
  }

  app.get("/api/a1/session", (req, res) => {
    const account = accounts.session(cookieToken(req));
    res.json({ account: account ? { email: account.email } : null });
  });

  app.post("/api/a1/session/register", async (req, res) => {
    authLimit(req.ip ?? "local");
    const b = object(req.body);
    const { account, recoveryCode, session } = await accounts.create(
      emailInput(b.email),
      passwordInput(b.password),
    );
    setSession(req, res, session);
    const result: AccountCreated = {
      account: { email: account.email },
      recoveryCode,
    };
    res.status(201).json(result);
  });

  app.post("/api/a1/session/login", async (req, res) => {
    authLimit(req.ip ?? "local");
    const b = object(req.body);
    const { account, session } = await accounts.login(
      emailInput(b.email),
      passwordInput(b.password),
    );
    setSession(req, res, session);
    res.json({ account: { email: account.email } });
  });

  app.post("/api/a1/session/reset", async (req, res) => {
    authLimit(req.ip ?? "local");
    const b = object(req.body);
    const { account, recoveryCode, session } = await accounts.reset(
      emailInput(b.email),
      tokenInput(b.code, "Kurtarma kodu"),
      passwordInput(b.password),
    );
    setSession(req, res, session);
    const result: AccountCreated = {
      account: { email: account.email },
      recoveryCode,
    };
    res.json(result);
  });

  app.delete("/api/a1/session", (req, res) => {
    accounts.endSession(cookieToken(req));
    res.clearCookie(sessionCookie, cookieOptions(req));
    res.json({ ok: true });
  });

  app.post("/api/a1/session/recovery", (req, res) => {
    const account = requireAccount(req);
    res.json({ recoveryCode: accounts.rotateRecovery(account.id) });
  });

  app.get(
    "/api/a1/workspace",
    owner((store, _req, res) => {
      res.json(workspaceState(store, modelConfigured));
    }),
  );

  app.put(
    "/api/a1/workspace/profile",
    owner((store, req, res) => {
      store.set("profile", profileKey, profileInput(req.body));
      res.json(workspaceState(store, modelConfigured));
    }),
  );

  app.post(
    "/api/a1/workspace/sources",
    owner((store, req, res) => {
      const now = new Date().toISOString();
      const data = knowledgeInput(req.body);
      transaction(store.db, () => {
        if (store.list("source").length >= 50)
          throw new HttpError(400, "Bir ajana en fazla 50 kaynak eklenebilir.");
        store.set("source", randomUUID(), {
          ...data,
          createdAt: now,
          updatedAt: now,
        });
      });
      res.status(201).json(workspaceState(store, modelConfigured));
    }),
  );

  app.put(
    "/api/a1/workspace/sources/:id",
    owner((store, req, res) => {
      const source = store.get<WorkspaceSource>(
        "source",
        text(req.params.id, "Kaynak kimliği", 100, true),
      );
      if (!source) throw new HttpError(404, "Kaynak bulunamadı.");
      store.set("source", source.id, {
        ...source,
        ...knowledgeInput(req.body),
        updatedAt: new Date().toISOString(),
      });
      res.json(workspaceState(store, modelConfigured));
    }),
  );

  app.delete(
    "/api/a1/workspace/sources/:id",
    owner((store, req, res) => {
      const id = text(req.params.id, "Kaynak kimliği", 100, true);
      if (!store.get("source", id))
        throw new HttpError(404, "Kaynak bulunamadı.");
      store.remove("source", id);
      res.json(workspaceState(store, modelConfigured));
    }),
  );

  app.post(
    "/api/a1/workspace/preview",
    owner(async (store, req, res, account) => {
      chatLimit(account.id);
      const current = draft(store);
      const question = text(object(req.body).question, "Soru", 8000, true);
      const signal = clientSignal(res);
      const result = await answer(current, question, signal);
      if (signal.aborted) return;
      if (result.source) store.set("preview", current.revision, true);
      res.json({ result, state: workspaceState(store, modelConfigured) });
    }),
  );

  app.put(
    "/api/a1/workspace/publication",
    owner((store, _req, res, account) => {
      transaction(store.db, () => {
        const current = draft(store);
        if (!current.sources.length || !store.get("preview", current.revision))
          throw new HttpError(
            400,
            "Yayınlamadan önce onaylı bir kaynak ekleyin ve testte kaynaklı bir yanıt alın.",
          );
        const previous = readPublication(store);
        if (
          previous?.status === "live" &&
          previous.revision === current.revision
        )
          return;
        store.set<Published>("publication", publicationKey, {
          ...current,
          slug:
            previous?.slug ?? slugFor(current.profile.businessName, account.id),
          status: "live",
          publishedAt: new Date().toISOString(),
        });
      });
      res.json(workspaceState(store, modelConfigured));
    }),
  );

  app.post(
    "/api/a1/workspace/publication/pause",
    owner((store, _req, res) => {
      transaction(store.db, () => {
        const publication = readPublication(store);
        if (!publication) throw new HttpError(404, "Yayın bulunamadı.");
        store.set<Published>("publication", publicationKey, {
          ...publication,
          status: "paused",
        });
      });
      res.json(workspaceState(store, modelConfigured));
    }),
  );

  app.get(
    "/api/a1/workspace/inbox",
    owner((store, _req, res) => {
      const items: InboxItem[] = store.conversations().map((conversation) => ({
        ...conversation,
        handoff: store.get<Handoff>("handoff", conversation.id) ?? null,
      }));
      res.json(items);
    }),
  );

  app.get(
    "/api/a1/workspace/inbox/:id",
    owner((store, req, res) => {
      const conversation = store.conversation(
        text(req.params.id, "Sohbet kimliği", 100, true),
      );
      if (!conversation) throw new HttpError(404, "Sohbet bulunamadı.");
      const thread: InboxThread = {
        ...conversation,
        handoff: store.get<Handoff>("handoff", conversation.id) ?? null,
        messages: store.messages(conversation.id),
      };
      res.json(thread);
    }),
  );

  app.post(
    "/api/a1/workspace/inbox/:id/resolve",
    owner((store, req, res) => {
      const id = text(req.params.id, "Sohbet kimliği", 100, true);
      const handoff = store.get<Handoff>("handoff", id);
      if (!handoff) throw new HttpError(404, "Talep bulunamadı.");
      const result = store.set<Handoff>("handoff", id, {
        ...handoff,
        status: "resolved",
      });
      res.json(result);
    }),
  );

  app.get("/api/a1/public/demo", (_req, res) => {
    res.json(customerAgent(demo, "demo"));
  });

  app.post("/api/a1/public/demo/message", async (req, res) => {
    chatLimit(req.ip ?? "local");
    const question = text(object(req.body).question, "Mesaj", 8000, true);
    const result = await answer(
      demo,
      question,
      clientSignal(res),
      undefined,
      false,
    );
    res.json(customerAnswer(result));
  });

  app.get(
    "/api/a1/public/:slug",
    visitor((_store, publication, _req, res) => {
      res.json(customerAgent(publication, publication.status));
    }),
  );

  app.post(
    "/api/a1/public/:slug/message",
    visitor(async (store, publication, req, res) => {
      if (publication.status !== "live")
        throw new HttpError(409, "Bu sohbet geçici olarak duraklatıldı.");
      chatLimit(req.ip ?? "local");
      const b = object(req.body);
      const question = text(b.question, "Mesaj", 8000, true);
      const visitorId = digest(tokenInput(b.visitor, "Sohbet oturumu"));
      const requestId = digest(
        visitorId + ":" + tokenInput(b.requestId, "Mesaj kimliği"),
      );
      const cached = previousAnswer(store, requestId, question);
      if (cached) {
        res.json(cached);
        return;
      }
      const lock = publication.slug + ":" + visitorId;
      if (activeRequests.has(lock) || activeRequests.size >= 12)
        throw new HttpError(
          409,
          "Bir yanıt hazırlanıyor. Lütfen tekrar deneyin.",
        );
      activeRequests.add(lock);
      const signal = clientSignal(res);
      try {
        const conversation = store.get<Visitor>("visitor", visitorId);
        const history = conversation
          ? store
              .recentMessages(conversation.conversationId, 6)
              .map(({ role, content }) => ({
                role,
                content: content.slice(0, 1200),
              }))
          : [];
        const result = customerAnswer(
          await answer(publication, question, signal, history),
        );
        if (signal.aborted) return;
        const saved = transaction(store.db, () => {
          const previous = previousAnswer(store, requestId, question);
          if (previous) return previous;
          const current = readPublication(store);
          if (
            current?.status !== "live" ||
            current.revision !== publication.revision
          )
            throw new HttpError(
              409,
              "Ajanın yayını değişti. Sorunuzu tekrar gönderin.",
            );
          const id = conversationFor(store, visitorId, question);
          store.addMessage(id, "user", question);
          store.addMessage(id, "assistant", result.text);
          store.set<SavedAnswer>("turn", requestId, { ...result, question });
          return result;
        });
        res.json(saved);
      } finally {
        activeRequests.delete(lock);
      }
    }),
  );

  app.post(
    "/api/a1/public/:slug/handoff",
    visitor((store, _publication, req, res) => {
      chatLimit(req.ip ?? "local");
      const b = object(req.body);
      const visitorId = digest(tokenInput(b.visitor, "Sohbet oturumu"));
      const question = text(b.question, "Talep", 8000, true);
      const email = emailInput(b.email);
      if (b.consent !== true)
        throw new HttpError(400, "Talebin işletmeye iletilmesini onaylayın.");
      transaction(store.db, () => {
        const id = conversationFor(store, visitorId, question);
        if (store.get<Handoff>("handoff", id)) return;
        store.addMessage(id, "user", "Destek talebi: " + question);
        store.set<Handoff>("handoff", id, {
          email,
          status: "open",
          createdAt: new Date().toISOString(),
        });
      });
      res.status(201).json({ ok: true });
    }),
  );

  app.use("/api", (_req, _res, next) =>
    next(new HttpError(404, "İşlem bulunamadı.")),
  );
  app.use(
    (
      error: unknown,
      _req: Request,
      res: Response,
      next: express.NextFunction,
    ) => {
      if (res.headersSent) return next(error);
      if (error instanceof HttpError)
        return res.status(error.status).json({ error: error.message });
      if ((error as { type?: string })?.type === "entity.too.large")
        return res.status(413).json({ error: "Gönderilen veri çok büyük." });
      if (error instanceof SyntaxError)
        return res.status(400).json({ error: "Geçersiz JSON verisi." });
      console.error(
        "A1 isteği tamamlanamadı:",
        error instanceof Error ? error.name : "Bilinmeyen hata",
      );
      return res
        .status(500)
        .json({ error: "İşlem tamamlanamadı. Lütfen tekrar deneyin." });
    },
  );

  return { app, close: () => accounts.close() };
}
