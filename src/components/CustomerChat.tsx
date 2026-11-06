import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowUp,
  Headphones,
  LifeBuoy,
  Mail,
  MessageSquare,
  Send,
} from "lucide-react";
import type { Answer, CustomerAgent, CustomerMessage } from "../../shared";
import { api, ApiError, json } from "../api";
import { Badge, Brand, ErrorNotice, Loading } from "./site-ui";

function token() {
  return btoa(
    String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))),
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export default function CustomerChat({
  slug,
  embedded,
}: {
  slug: string;
  embedded: boolean;
}) {
  const path = "/a1/public/" + slug;
  const [visitor] = useState(token);
  const [agent, setAgent] = useState<CustomerAgent | null>(null);
  const [messages, setMessages] = useState<CustomerMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [contactOpen, setContactOpen] = useState(false);
  const [handoffQuestion, setHandoffQuestion] = useState("");
  const [contactPending, setContactPending] = useState(false);
  const [contactSent, setContactSent] = useState(false);
  const [contactError, setContactError] = useState("");
  const retry = useRef<{ question: string; requestId: string } | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const messageInput = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const abort = new AbortController();
    void api<CustomerAgent>(path, { signal: abort.signal })
      .then((data) => {
        if (!abort.signal.aborted) setAgent(data);
      })
      .catch((error: Error) => {
        if (!abort.signal.aborted) setLoadError(error.message);
      });
    return () => abort.abort();
  }, [path]);

  useEffect(() => {
    if (messages.length) bottom.current?.scrollIntoView({ block: "nearest" });
  }, [messages]);

  function offerContact(question?: string) {
    setHandoffQuestion(
      question ??
        messages.findLast((message) => message.role === "user")?.content ??
        "",
    );
    setContactOpen(true);
  }

  async function send(question: string) {
    question = question.trim();
    if (!question || pending || agent?.status === "paused") return;
    if (retry.current?.question !== question)
      retry.current = { question, requestId: token() };
    setPending(true);
    setError("");
    try {
      const answer = await api<Answer>(path + "/message", {
        method: "POST",
        body: json({ question, visitor, requestId: retry.current.requestId }),
      });
      const content =
        answer.handoff && agent?.status === "demo"
          ? "Örnek bilgi bankasında bu sorunun yanıtı yok. Teslimat, çalışma saatleri veya iade hakkında örnek bir soru seçebilirsiniz."
          : answer.text;
      setMessages((current) => [
        ...current,
        { role: "user", content: question },
        { role: "assistant", content },
      ]);
      setDraft("");
      retry.current = null;
      if (answer.handoff && agent?.status !== "demo" && !contactSent)
        offerContact(question);
    } catch (error) {
      setError((error as Error).message);
      if (error instanceof ApiError && error.status === 409)
        void api<CustomerAgent>(path)
          .then(setAgent)
          .catch(() => {});
    } finally {
      setPending(false);
    }
  }

  async function handoff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (contactPending) return;
    const form = new FormData(event.currentTarget);
    setContactError("");
    setContactPending(true);
    try {
      await api(path + "/handoff", {
        method: "POST",
        body: json({
          visitor,
          question: handoffQuestion,
          email: form.get("email"),
          consent: form.get("consent") === "on",
        }),
      });
      setContactSent(true);
      setContactOpen(false);
    } catch (error) {
      setContactError((error as Error).message);
    } finally {
      setContactPending(false);
    }
  }

  return (
    <div className={"a1-customer" + (embedded ? " a1-customer-embedded" : "")}>
      {!embedded && (
        <header className="a1-container a1-customer-top">
          <Brand />
          <Badge>Kapalı test</Badge>
        </header>
      )}
      <main className="a1-chat-card">
        {loadError ? (
          <div className="a1-chat-empty">
            <MessageSquare size={26} />
            <h1>Sohbet açılamadı</h1>
            <ErrorNotice message={loadError} />
          </div>
        ) : !agent ? (
          <div className="a1-chat-empty">
            <Loading>Sohbet hazırlanıyor…</Loading>
          </div>
        ) : (
          <>
            <header className="a1-chat-header">
              <span className="a1-stage-icon">
                <Headphones size={22} />
              </span>
              <div>
                <h1>{agent.agentName}</h1>
                <p>{agent.businessName} · Yapay zekâ asistanı</p>
              </div>
              {agent.status === "demo" && <Badge>Demo</Badge>}
            </header>
            {agent.status === "paused" ? (
              <div className="a1-chat-empty">
                <LifeBuoy size={26} />
                <h2>Sohbet duraklatıldı</h2>
                <p>İşletmeye bir geri dönüş talebi bırakabilirsiniz.</p>
                {agent.contactEmail && (
                  <a
                    href={
                      "mailto:" +
                      encodeURIComponent(agent.contactEmail).replace(
                        /%40/g,
                        "@",
                      )
                    }
                  >
                    <Mail size={16} /> {agent.contactEmail}
                  </a>
                )}
              </div>
            ) : (
              <>
                <div
                  className="a1-chat-log"
                  role="log"
                  aria-label="Sohbet mesajları"
                  aria-busy={pending}
                >
                  {!messages.length ? (
                    <div className="a1-chat-empty">
                      <MessageSquare size={26} />
                      <h2>Merhaba, nasıl yardımcı olabilirim?</h2>
                      <p>
                        {agent.status === "demo"
                          ? "Bu sohbet örnek işletme bilgileriyle çalışır."
                          : "İşletmenin ürün ve hizmetleri hakkında bir soru sorun."}
                      </p>
                    </div>
                  ) : (
                    <ol className="a1-messages">
                      {messages.map((message, index) => (
                        <li
                          key={index}
                          className={"a1-message " + message.role}
                        >
                          <strong>
                            {message.role === "assistant"
                              ? agent.agentName
                              : "Siz"}
                          </strong>
                          <p>{message.content}</p>
                        </li>
                      ))}
                    </ol>
                  )}
                  <div ref={bottom} />
                </div>
                {pending && (
                  <div className="a1-chat-progress">
                    <Loading>Yanıt hazırlanıyor…</Loading>
                  </div>
                )}
                {!messages.length && !!agent.suggestions.length && (
                  <div
                    className="a1-suggestions a1-chat-suggestions"
                    aria-label="Örnek sorular"
                  >
                    {agent.suggestions.map((question) => (
                      <button
                        type="button"
                        key={question}
                        disabled={pending}
                        onClick={() => {
                          setDraft(question);
                          messageInput.current?.focus();
                        }}
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                )}
                <form
                  className="a1-composer"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void send(draft);
                  }}
                >
                  <ErrorNotice message={error} />
                  <label className="sr-only" htmlFor="a1-customer-message">
                    Mesajınız
                  </label>
                  <textarea
                    id="a1-customer-message"
                    ref={messageInput}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    maxLength={8000}
                    rows={2}
                    placeholder="Bir soru yazın…"
                    disabled={pending}
                  />
                  <button
                    type="submit"
                    aria-label="Mesaj gönder"
                    className="button primary"
                    disabled={pending || !draft.trim()}
                  >
                    <ArrowUp size={21} />
                  </button>
                </form>
              </>
            )}
            {agent.status !== "demo" && (
              <div className="a1-contact">
                {contactSent ? (
                  <p role="status" className="a1-contact-confirmation">
                    Talebiniz işletmeye iletildi.
                  </p>
                ) : contactOpen ? (
                  <form
                    className="a1-handoff-form"
                    onSubmit={(event) => void handoff(event)}
                  >
                    <div className="a1-section-bar">
                      <h3>
                        <LifeBuoy size={18} /> Ekibe talep bırakın
                      </h3>
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() => setContactOpen(false)}
                        disabled={contactPending}
                      >
                        Vazgeç
                      </button>
                    </div>
                    <label>
                      Talebiniz
                      <textarea
                        value={handoffQuestion}
                        onChange={(e) => setHandoffQuestion(e.target.value)}
                        rows={3}
                        maxLength={8000}
                        required
                      />
                    </label>
                    <label>
                      Geri dönüş e-postası{" "}
                      <input
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        maxLength={254}
                      />
                    </label>
                    <label className="a1-check">
                      <input name="consent" type="checkbox" required /> Bu
                      talebin ve e-posta adresimin işletmeye iletilmesini
                      onaylıyorum.
                    </label>
                    <ErrorNotice message={contactError} />
                    <button
                      type="submit"
                      className="button primary"
                      disabled={contactPending}
                    >
                      {contactPending ? "Gönderiliyor…" : "Talebi ilet"}{" "}
                      <Send size={16} />
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    className="button secondary"
                    disabled={pending}
                    onClick={() => offerContact()}
                  >
                    <LifeBuoy size={18} /> Ekibe ulaş
                  </button>
                )}
                <p className="a1-muted">
                  Sohbet işletmenin çalışma alanına kaydedilir.
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
