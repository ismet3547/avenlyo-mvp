import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { createA1App } from "../server/a1.js";
import { answerQuestion, demoProfile } from "../server/answers.js";
import type { GenerateInput, Provider } from "../server/provider.js";
import type {
  AccountCreated,
  Answer,
  CustomerAgent,
  InboxItem,
  InboxThread,
  PreviewAnswer,
  WorkspaceSource,
  WorkspaceState,
} from "../shared.js";

const question = "Teslimat kaç gün sürer?";
const firstAnswer = "Ürünler 3 iş günü içinde kargoya verilir.";
const secondAnswer = "Ürünler 5 iş günü içinde kargoya verilir.";
const password = "test-password-avenlyo-1";
const token = () => randomBytes(32).toString("base64url");

function cookie(response: Response) {
  const value = response.headers.get("set-cookie");
  assert.match(value ?? "", /; HttpOnly;/);
  assert.match(value ?? "", /SameSite=Strict/);
  return value!.split(";")[0];
}

test(
  "A1 hesap izolasyonu, önizleme, sabit yayın ve gelen talep akışı",
  { timeout: 20000 },
  async () => {
    const dir = mkdtempSync(resolve(".test-data-a1-"));
    const { app, close } = createA1App(dir, {});
    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const port = (server.address() as { port: number }).port;
    const base = "http://127.0.0.1:" + port + "/api/a1";
    function call(
      path: string,
      method = "GET",
      body?: unknown,
      session = "",
      extra: Record<string, string> = {},
    ) {
      return fetch(base + path, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(session ? { Cookie: session } : {}),
          ...extra,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    }
    try {
      assert.equal((await call("/workspace")).status, 401);
      assert.equal(
        (
          await call(
            "/session/register",
            "POST",
            { email: "foreign@example.com", password },
            "",
            { Origin: "https://untrusted.example" },
          )
        ).status,
        403,
      );
      assert.equal(
        (await call("/public/demo/message", "POST", { question })).status,
        200,
      );

      const first = await call("/session/register", "POST", {
        email: "one@example.com",
        password,
      });
      assert.equal(first.status, 201);
      const one = cookie(first);
      const registration = (await first.json()) as AccountCreated;
      assert.equal(registration.account.email, "one@example.com");
      assert.match(registration.recoveryCode, /^[A-Za-z0-9_-]{43}$/);

      const second = await call("/session/register", "POST", {
        email: "two@example.com",
        password,
      });
      assert.equal(second.status, 201);
      const two = cookie(second);
      await second.json();
      assert.equal(
        (
          await call("/session/login", "POST", {
            email: "one@example.com",
            password: "wrong-password-avenlyo",
          })
        ).status,
        401,
      );

      const profile = {
        businessName: "Deneme İşletmesi",
        agentName: "Destek",
        description: "",
        tone: "Samimi",
        contactEmail: "destek@example.com",
      };
      assert.equal(
        (await call("/workspace/profile", "PUT", profile, one)).status,
        200,
      );
      const faq = {
        title: "Teslimat",
        question,
        content: firstAnswer,
        approved: true,
      };
      const sourceResponse = await call("/workspace/sources", "POST", faq, one);
      assert.equal(sourceResponse.status, 201);
      const { sources } = (await sourceResponse.json()) as WorkspaceState;
      const source = sources[0];
      assert.equal(
        (await call("/workspace/sources/" + source.id, "PUT", faq, two)).status,
        404,
      );
      assert.equal(
        (
          await call(
            "/workspace/sources/" + source.id,
            "DELETE",
            undefined,
            two,
          )
        ).status,
        404,
      );
      assert.deepEqual(
        (
          (await (
            await call("/workspace", "GET", undefined, two)
          ).json()) as WorkspaceState
        ).sources,
        [],
      );
      assert.equal(
        (
          await call(
            "/workspace/sources",
            "POST",
            {
              title: "Özel taslak",
              question: "Gizli örnek soru?",
              content: "test-private-draft",
              approved: false,
            },
            one,
          )
        ).status,
        201,
      );

      assert.equal(
        (await call("/workspace/publication", "PUT", undefined, one)).status,
        400,
      );
      const unknown = (await (
        await call(
          "/workspace/preview",
          "POST",
          { question: "Gizli örnek soru?" },
          one,
        )
      ).json()) as { result: PreviewAnswer };
      assert.equal(unknown.result.handoff, true);
      const preview = (await (
        await call("/workspace/preview", "POST", { question }, one)
      ).json()) as { result: PreviewAnswer; state: WorkspaceState };
      assert.equal(preview.result.text, firstAnswer);
      assert.equal(preview.result.source?.id, source.id);
      assert.equal(preview.state.tested, true);
      assert.deepEqual(
        await (await call("/workspace/inbox", "GET", undefined, one)).json(),
        [],
      );

      const published = (await (
        await call("/workspace/publication", "PUT", undefined, one)
      ).json()) as WorkspaceState;
      const slug = published.publication!.slug;
      assert.equal(published.publication?.status, "live");
      const customerPath = "/public/" + slug;
      const customer = (await (
        await call(customerPath)
      ).json()) as CustomerAgent;
      assert.deepEqual(customer.suggestions, [question]);
      assert.equal(customer.contactEmail, "");
      assert.equal(
        (await call("/public/" + slug.replace(/^deneme/, "other"))).status,
        404,
      );

      const visitor = token();
      const requestId = token();
      const payload = { question, visitor, requestId };
      const answered = (await (
        await call(customerPath + "/message", "POST", payload)
      ).json()) as Answer;
      assert.deepEqual(answered, { text: firstAnswer, handoff: false });
      assert.deepEqual(
        await (await call(customerPath + "/message", "POST", payload)).json(),
        answered,
      );
      assert.equal(
        (
          await call(customerPath + "/message", "POST", {
            ...payload,
            question: "Farklı bir soru",
          })
        ).status,
        409,
      );
      const missedQuestion = "Yerinde montaj yapıyor musunuz?";
      const missed = (await (
        await call(customerPath + "/message", "POST", {
          question: missedQuestion,
          visitor,
          requestId: token(),
        })
      ).json()) as Answer;
      assert.equal(missed.handoff, true);
      const handoff = {
        visitor,
        question: missedQuestion,
        email: "customer@example.com",
      };
      assert.equal(
        (await call(customerPath + "/handoff", "POST", handoff)).status,
        400,
      );
      assert.equal(
        (
          await call(customerPath + "/handoff", "POST", {
            ...handoff,
            consent: true,
          })
        ).status,
        201,
      );
      assert.equal(
        (
          await call(customerPath + "/handoff", "POST", {
            ...handoff,
            consent: true,
          })
        ).status,
        201,
      );

      const inbox = (await (
        await call("/workspace/inbox", "GET", undefined, one)
      ).json()) as InboxItem[];
      assert.equal(inbox.length, 1);
      assert.equal(inbox[0].handoff?.status, "open");
      const threadPath = "/workspace/inbox/" + inbox[0].id;
      assert.equal((await call(threadPath, "GET", undefined, two)).status, 404);
      assert.equal(
        (await call(threadPath + "/resolve", "POST", undefined, two)).status,
        404,
      );
      const thread = (await (
        await call(threadPath, "GET", undefined, one)
      ).json()) as InboxThread;
      assert.equal(thread.messages.length, 5);
      assert.equal(thread.handoff?.email, handoff.email);
      assert.equal(
        (
          await (
            await call(threadPath + "/resolve", "POST", undefined, one)
          ).json()
        ).status,
        "resolved",
      );

      const edited = (await (
        await call(
          "/workspace/sources/" + source.id,
          "PUT",
          { ...faq, content: secondAnswer },
          one,
        )
      ).json()) as WorkspaceState;
      assert.equal(edited.unpublishedChanges, true);
      assert.equal(edited.tested, false);
      assert.equal(
        (await call("/workspace/publication", "PUT", undefined, one)).status,
        400,
      );
      const before = (await (
        await call(customerPath + "/message", "POST", {
          ...payload,
          requestId: token(),
        })
      ).json()) as Answer;
      assert.equal(before.text, firstAnswer);
      await (
        await call("/workspace/preview", "POST", { question }, one)
      ).json();
      const republished = (await (
        await call("/workspace/publication", "PUT", undefined, one)
      ).json()) as WorkspaceState;
      assert.equal(republished.publication?.slug, slug);
      const after = (await (
        await call(customerPath + "/message", "POST", {
          ...payload,
          requestId: token(),
        })
      ).json()) as Answer;
      assert.equal(after.text, secondAnswer);

      const paused = (await (
        await call("/workspace/publication/pause", "POST", undefined, one)
      ).json()) as WorkspaceState;
      assert.equal(paused.publication?.status, "paused");
      const pausedPage = (await (
        await call(customerPath)
      ).json()) as CustomerAgent;
      assert.equal(pausedPage.contactEmail, profile.contactEmail);
      assert.equal(
        (
          await call(customerPath + "/message", "POST", {
            ...payload,
            requestId: token(),
          })
        ).status,
        409,
      );

      const reset = await call("/session/reset", "POST", {
        email: registration.account.email,
        code: registration.recoveryCode,
        password: "test-password-avenlyo-2",
      });
      assert.equal(reset.status, 200);
      const restored = cookie(reset);
      assert.equal(
        (await call("/workspace", "GET", undefined, one)).status,
        401,
      );
      const recovered = (await (
        await call("/workspace", "GET", undefined, restored)
      ).json()) as WorkspaceState;
      assert.equal(recovered.profile?.businessName, profile.businessName);
      assert.equal(
        (
          await call("/session/reset", "POST", {
            email: registration.account.email,
            code: registration.recoveryCode,
            password,
          })
        ).status,
        401,
      );
      assert.equal(
        (
          await call("/session/login", "POST", {
            email: registration.account.email,
            password: "test-password-avenlyo-2",
          })
        ).status,
        200,
      );
    } finally {
      server.closeAllConnections();
      await new Promise<void>((done) => server.close(() => done()));
      close();
      rmSync(dir, { recursive: true, force: true });
    }
  },
);

test("A1 model yanıtı yalnızca seçilen onaylı metin parçalarından döner", async () => {
  let input: GenerateInput | undefined;
  let selection = "1";
  const provider: Provider = {
    test: async () => {},
    generate: async (value) => {
      input = value;
      return selection;
    },
  };
  const source: WorkspaceSource = {
    id: "source-one",
    title: "Pazar teslimat",
    question: "",
    category: "Metin",
    approved: true,
    content: "Pazar günü teslimat yapılmaz.",
    createdAt: "",
    updatedAt: "",
  };
  const options = {
    provider,
    apiKey: "sk-review-placeholder",
    model: "mock",
    signal: new AbortController().signal,
  };
  const result = await answerQuestion(
    demoProfile,
    [source],
    "Pazar teslimat var mı?",
    options,
  );
  assert.equal(result.text, source.content);
  assert.equal(result.source?.id, source.id);
  assert.equal(input?.sources[0].content, source.content);
  selection = "Uydurulmuş fiyat: 25.000 TL";
  assert.equal(
    (
      await answerQuestion(
        demoProfile,
        [source],
        "Pazar teslimat var mı?",
        options,
      )
    ).handoff,
    true,
  );
  selection = "0";
  assert.equal(
    (
      await answerQuestion(
        demoProfile,
        [source],
        "Pazar teslimat var mı?",
        options,
      )
    ).handoff,
    true,
  );
});
