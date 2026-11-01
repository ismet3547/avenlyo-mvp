import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import { once } from "node:events";
import { request } from "node:http";
import OpenAI from "openai";
import { Store } from "../server/store.js";
import { Config } from "../server/config.js";
import { createApp } from "../server/app.js";
import {
  OpenAIProvider,
  type GenerateInput,
  type Provider,
} from "../server/provider.js";
import type { Agent, AppState, Source } from "../shared.js";

test("yerel yönetim, kaynak kapsamı, sohbet kalıcılığı ve hata atomikliği", async () => {
  const dir = mkdtempSync(resolve(".test-data-"));
  const store = new Store(join(dir, "test.sqlite")),
    config = new Config(dir, {});
  let last: GenerateInput | undefined,
    fail = false;
  const provider: Provider = {
    test: async () => {},
    generate: async (input) => {
      last = input;
      if (fail) throw new Error("upstream private detail");
      input.onDelta("Merhaba, ");
      input.onDelta("Avenlyo!");
      return "Merhaba, Avenlyo!";
    },
  };
  const server = createApp(store, config, provider).listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as { port: number },
    base = `http://127.0.0.1:${address.port}/api`;
  async function call(
    path: string,
    method = "GET",
    body?: unknown,
    headers: Record<string, string> = {},
  ) {
    return fetch(base + path, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }
  try {
    let state = (await (await call("/state")).json()) as AppState;
    assert.equal(state.agents.length, 3);
    assert.equal(state.settings.configured, false);
    const baseAgent = state.agents[0];
    const missing = await call("/chat", "POST", {
      agentId: baseAgent.id,
      content: "Merhaba",
    });
    assert.equal(missing.status, 400);
    assert.equal(store.conversations().length, 0);
    const malformed = await call("/agents", "POST", { name: "" });
    assert.equal(malformed.status, 400);
    const csrf = await call(
      "/business",
      "PUT",
      {},
      { Origin: "https://untrusted.example" },
    );
    assert.equal(csrf.status, 403);
    const rebinding = await new Promise<number>((done, reject) => {
      request(
        base + "/state",
        { headers: { Host: "untrusted.example" } },
        (res) => {
          res.resume();
          done(res.statusCode!);
        },
      )
        .on("error", reject)
        .end();
    });
    assert.equal(rebinding, 403);
    const business = {
      name: "Test işletmesi",
      description: "El yapımı kahve ürünleri",
      industry: "Perakende",
      audience: "Kahveseverler",
      products: "Kahve fincanı",
      tone: "Samimi",
      website: "https://example.com",
    };
    assert.equal((await call("/business", "PUT", business)).status, 200);
    const assigned = (await (
      await call("/sources", "POST", {
        title: "Kargo",
        content: "Teslimat 3 iş günü.",
        category: "Genel",
      })
    ).json()) as Source;
    const privateSource = (await (
      await call("/sources", "POST", {
        title: "Atanmamış",
        content: "BU BİLGİ GİTMEMELİ",
        category: "Genel",
      })
    ).json()) as Source;
    // Update through the id-specific route and reject non-existent references.
    assert.equal(
      (
        await call(`/agents/${baseAgent.id}`, "PUT", {
          ...baseAgent,
          sourceIds: ["nonexistent"],
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await call(`/agents/${baseAgent.id}`, "PUT", {
          ...baseAgent,
          sourceIds: [assigned.id],
        })
      ).status,
      200,
    );
    const key = "sk-test-secret-never-in-export";
    assert.equal(
      (await call("/settings", "PUT", { apiKey: key, model: "gpt-4.1-mini" }))
        .status,
      200,
    );
    const response = await call("/chat", "POST", {
      agentId: baseAgent.id,
      content: "Kargo kaç gün?",
    });
    assert.equal(response.status, 200);
    const events = (await response.text())
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    assert.deepEqual(
      events.filter((e) => e.type === "delta").map((e) => e.delta),
      ["Merhaba, ", "Avenlyo!"],
    );
    assert.equal(events.at(-1).type, "done");
    const conversationId = events[0].conversation.id;
    assert.equal(store.messages(conversationId).length, 2);
    assert.equal(last!.business.name, business.name);
    assert.deepEqual(
      last!.sources.map((s) => s.id),
      [assigned.id],
    );
    assert.equal(
      last!.sources.some((s) => s.id === privateSource.id),
      false,
    );
    await call("/chat", "POST", {
      agentId: baseAgent.id,
      conversationId,
      content: "Teşekkürler",
    }).then((r) => r.text());
    assert.equal(last!.messages.length, 3);
    assert.equal(store.messages(conversationId).length, 4);
    fail = true;
    const failed = await call("/chat", "POST", {
      agentId: baseAgent.id,
      conversationId,
      content: "Başarısız istek",
    });
    const failedText = await failed.text();
    assert.match(failedText, /"type":"error"/);
    assert.doesNotMatch(failedText, /private detail/);
    assert.equal(store.messages(conversationId).length, 4);
    const count = store.conversations().length;
    await call("/chat", "POST", {
      agentId: baseAgent.id,
      content: "Yeni başarısız sohbet",
    }).then((r) => r.text());
    assert.equal(store.conversations().length, count);
    const exportText = await (await call("/export")).text();
    assert.doesNotMatch(exportText, /sk-test|apiKey/);
    const stateText = await (await call("/state")).text();
    assert.doesNotMatch(stateText, /sk-test-secret/);
    assert.equal(new Config(dir, {}).key(), key);
    assert.equal((await call(`/sources/${assigned.id}`, "DELETE")).status, 200);
    assert.deepEqual(store.get<Agent>("agent", baseAgent.id)!.sourceIds, []);
    assert.equal((await call(`/agents/${baseAgent.id}`, "DELETE")).status, 200);
    assert.equal(store.conversations().length, 0);
    assert.equal(
      store.db.prepare("SELECT COUNT(*) as n FROM messages").get()!.n,
      0,
    );
    const other = new Store(join(dir, "test.sqlite"));
    assert.equal(other.agents().length, 2);
    assert.equal(other.business().name, business.name);
    other.close();
  } finally {
    server.closeAllConnections();
    await new Promise<void>((done) => server.close(() => done()));
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test(
  "iptal ve eşzamanlı üretimde konuşma bütünlüğü",
  { timeout: 5000 },
  async () => {
    const dir = mkdtempSync(resolve(".test-data-"));
    const store = new Store(join(dir, "test.sqlite")),
      config = new Config(dir, {});
    config.save({ apiKey: "sk-test-cancellation-key", model: "gpt-4.1-mini" });
    let observedAbort!: () => void;
    const aborted = new Promise<void>((done) => {
      observedAbort = done;
    });
    const provider: Provider = {
      test: async () => {},
      generate: (input) =>
        new Promise((_done, reject) => {
          input.onDelta("Tamamlanmamış yanıt");
          input.signal.addEventListener(
            "abort",
            () => {
              observedAbort();
              reject(new Error("cancelled"));
            },
            { once: true },
          );
        }),
    };
    const server = createApp(store, config, provider).listen(0, "127.0.0.1");
    await once(server, "listening");
    const port = (server.address() as { port: number }).port,
      base = `http://127.0.0.1:${port}/api`,
      agentId = store.agents()[0].id;
    const abort = new AbortController();
    try {
      const response = await fetch(base + "/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, content: "İptal edilecek mesaj" }),
        signal: abort.signal,
      });
      const reader = response.body!.getReader();
      const first = new TextDecoder().decode((await reader.read()).value);
      const conversationId = JSON.parse(first.trim().split("\n")[0])
        .conversation.id;
      const concurrent = await fetch(base + "/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          conversationId,
          content: "İkinci istek",
        }),
      });
      assert.equal(concurrent.status, 409);
      await concurrent.json();
      const deletion = await fetch(base + `/agents/${agentId}`, {
        method: "DELETE",
      });
      assert.equal(deletion.status, 409);
      await deletion.json();
      abort.abort();
      await aborted;
      await new Promise<void>((done) => setImmediate(done));
      assert.equal(store.conversations().length, 0);
      assert.equal(
        store.db.prepare("SELECT COUNT(*) AS n FROM messages").get()!.n,
        0,
      );
    } finally {
      abort.abort();
      server.closeAllConnections();
      await new Promise<void>((done) => server.close(() => done()));
      store.close();
      rmSync(dir, { recursive: true, force: true });
    }
  },
);

test("gerçek OpenAI SDK akış sözleşmesi: içerik, tamamlanma ve hata", async () => {
  const dir = mkdtempSync(resolve(".test-data-"));
  const store = new Store(join(dir, "test.sqlite"));
  try {
    let payload: Record<string, unknown> = {},
      failure = false;
    const provider = new OpenAIProvider(
      (apiKey) =>
        new OpenAI({
          apiKey,
          maxRetries: 0,
          fetch: async (_url, init) => {
            payload = JSON.parse(init?.body as string);
            if (failure)
              return new Response(
                JSON.stringify({
                  error: {
                    message: "private sk-secret",
                    type: "invalid_request_error",
                    code: "invalid_api_key",
                  },
                }),
                {
                  status: 401,
                  headers: { "Content-Type": "application/json" },
                },
              );
            const events = [
              { type: "response.output_text.delta", delta: "Gerçek SDK " },
              { type: "response.output_text.delta", delta: "akışı." },
              {
                type: "response.completed",
                response: { id: "resp_test", status: "completed" },
              },
            ];
            return new Response(
              events
                .map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`)
                .join("") + "data: [DONE]\n\n",
              { headers: { "Content-Type": "text/event-stream" } },
            );
          },
        }),
    );
    const deltas: string[] = [];
    const input: GenerateInput = {
      apiKey: "sk-test-key",
      model: "gpt-4.1-mini",
      agent: store.agents()[0],
      business: store.business(),
      sources: [],
      messages: [{ role: "user", content: "Merhaba" }],
      signal: new AbortController().signal,
      onDelta: (d) => deltas.push(d),
    };
    assert.equal(await provider.generate(input), "Gerçek SDK akışı.");
    assert.deepEqual(deltas, ["Gerçek SDK ", "akışı."]);
    assert.equal(payload.store, false);
    assert.equal(payload.stream, true);
    assert.match(String(payload.instructions), /isletme_verisi/);
    failure = true;
    await assert.rejects(
      () => provider.generate(input),
      /anahtarı doğrulanamadı/,
    );
    assert.equal(JSON.stringify(payload).includes("sk-test-key"), false);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
