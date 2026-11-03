import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  ArrowRight,
  ArrowUp,
  Bot,
  Check,
  ChevronDown,
  Copy,
  FileText,
  LoaderCircle,
  MessageSquare,
  Plus,
  Settings2,
  ShieldCheck,
  Square,
  Trash2,
} from "lucide-react";
import Markdown from "react-markdown";
import type { AppState, Conversation, Message } from "../../shared";
import { api, json } from "../api";
import { AgentIcon, Empty, Modal, formatDate } from "./ui";

type Props = {
  state: AppState;
  initialAgent?: string;
  refresh: () => Promise<void>;
  onSettings: () => void;
};
export default function Chat({
  state,
  initialAgent,
  refresh,
  onSettings,
}: Props) {
  const [agentId, setAgentId] = useState(
      state.agents.find((a) => a.id === initialAgent)?.id ||
        state.agents.find((a) => a.active)?.id ||
        state.agents[0]?.id ||
        "",
    ),
    [conversationId, setConversationId] = useState<string>();
  const [messages, setMessages] = useState<Message[]>([]),
    [draft, setDraft] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [deleteId, setDeleteId] = useState<string>(),
    [copied, setCopied] = useState("");
  const controller = useRef<AbortController | null>(null),
    bottom = useRef<HTMLDivElement>(null),
    input = useRef<HTMLTextAreaElement>(null);
  const agent = state.agents.find((a) => a.id === agentId),
    conversations = state.conversations.filter((c) => c.agentId === agentId);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "instant", block: "end" });
  }, [messages, busy]);
  function startNew(nextAgent = agentId) {
    if (busy) return;
    setAgentId(nextAgent);
    setConversationId(undefined);
    setMessages([]);
    setError("");
    setDraft("");
    input.current?.focus();
  }
  async function open(conversation: Conversation) {
    if (busy || loading) return;
    setLoading(true);
    setError("");
    try {
      const next = await api<Message[]>(
        `/conversations/${conversation.id}/messages`,
      );
      setMessages(next);
      setAgentId(conversation.agentId);
      setConversationId(conversation.id);
      setDraft("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  async function send(event?: FormEvent, override?: string) {
    event?.preventDefault();
    const content = (override ?? draft).trim();
    if (!content || busy || !agent || !state.settings.configured) return;
    const previous = messages,
      oldId = conversationId;
    let confirmedId = oldId,
      completed = false;
    setBusy(true);
    setError("");
    setDraft("");
    const now = new Date().toISOString(),
      optimisticUser = {
        id: "pending-user",
        conversationId: oldId || "",
        role: "user" as const,
        content,
        createdAt: now,
      },
      optimisticAssistant = {
        id: "pending-assistant",
        conversationId: oldId || "",
        role: "assistant" as const,
        content: "",
        createdAt: now,
      };
    setMessages([...previous, optimisticUser, optimisticAssistant]);
    const abort = new AbortController();
    controller.current = abort;
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: json({ agentId: agent.id, conversationId: oldId, content }),
        signal: abort.signal,
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error || "Yanıt alınamadı.");
      }
      if (!response.body) throw new Error("Yanıt akışı başlatılamadı.");
      const reader = response.body.getReader(),
        decoder = new TextDecoder();
      let buffer = "";
      const consume = (line: string) => {
        if (!line.trim()) return;
        const event = JSON.parse(line);
        if (event.type === "conversation") {
          confirmedId = event.conversation.id;
          setConversationId(confirmedId);
        }
        if (event.type === "delta")
          setMessages((current) =>
            current.map((m) =>
              m.id === "pending-assistant"
                ? { ...m, content: m.content + event.delta }
                : m,
            ),
          );
        if (event.type === "error") throw new Error(event.error);
        if (event.type === "done") {
          completed = true;
          setMessages([...previous, ...event.messages]);
        }
      };
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) consume(line);
      }
      buffer += decoder.decode();
      if (buffer.trim()) consume(buffer);
      if (!completed)
        throw new Error(
          "Bağlantı kesildi. Mesajınız kaydedilmedi; tekrar gönderebilirsiniz.",
        );
    } catch (e) {
      // On a late connection loss, check whether the server committed the turn.
      let recovered = false;
      if (confirmedId) {
        try {
          const saved = await api<Message[]>(
            `/conversations/${confirmedId}/messages`,
          );
          if (saved.length > previous.length) {
            setMessages(saved);
            recovered = true;
          }
        } catch {
          /* A failed first turn has no persisted conversation. */
        }
      }
      if (!recovered) {
        setMessages(previous);
        setConversationId(oldId);
        setDraft(content);
        setError(
          abort.signal.aborted
            ? "Yanıt durduruldu. Bu tur kaydedilmedi; mesajınızı yeniden gönderebilirsiniz."
            : (e as Error).message,
        );
      }
    } finally {
      setBusy(false);
      controller.current = null;
      void refresh().catch(() => {});
      input.current?.focus();
    }
  }
  function keyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send();
    }
  }
  async function remove() {
    if (!deleteId) return;
    try {
      await api(`/conversations/${deleteId}`, { method: "DELETE" });
      if (conversationId === deleteId) startNew();
      setDeleteId(undefined);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function copy(message: Message) {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(message.id);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      setError("Metin kopyalanamadı. Mesajı seçerek kopyalayabilirsiniz.");
    }
  }
  if (!state.agents.length)
    return (
      <Empty
        icon={<Bot />}
        title="Önce bir ajan oluşturun"
        description="Ajanlarım sayfasından ilk ajanınızı ekleyerek başlayın."
      />
    );
  return (
    <div className="chat-layout">
      <aside className="conversation-sidebar">
        <div className="conversation-heading">
          <span>Sohbetler</span>
          <button
            className="icon-button"
            aria-label="Yeni sohbet"
            disabled={busy || loading}
            onClick={() => startNew()}
          >
            <Plus size={18} />
          </button>
        </div>
        <button
          className="button secondary new-chat"
          disabled={busy || loading}
          onClick={() => startNew()}
        >
          <Plus size={16} />
          Yeni sohbet
        </button>
        <div className="conversation-list">
          {conversations.length ? (
            conversations.map((c) => (
              <div
                key={c.id}
                className={`conversation-item ${conversationId === c.id ? "selected" : ""}`}
              >
                <button
                  aria-label={c.title}
                  title={c.title}
                  disabled={busy || loading}
                  onClick={() => void open(c)}
                >
                  <MessageSquare size={15} />
                  <span>
                    <strong>{c.title}</strong>
                    <small>{formatDate(c.updatedAt)}</small>
                  </span>
                </button>
                <button
                  className="icon-button"
                  aria-label={`${c.title} sohbetini sil`}
                  disabled={busy}
                  onClick={() => setDeleteId(c.id)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          ) : (
            <div className="conversation-empty">
              <MessageSquare size={22} />
              <p>
                Fikirleriniz burada
                <br />
                birikmeye başlayacak.
              </p>
            </div>
          )}
        </div>
        <div className="conversation-footer">
          <ShieldCheck size={14} />
          Sohbetler yerel olarak saklanır.
        </div>
      </aside>
      <section className="chat-panel">
        <div className="mobile-chat-history">
          <label className="sr-only" htmlFor="mobile-conversation">
            Sohbet geçmişi
          </label>
          <select
            id="mobile-conversation"
            value={conversationId || ""}
            disabled={busy || loading}
            onChange={(event) => {
              const conversation = conversations.find(
                (item) => item.id === event.target.value,
              );
              if (conversation) void open(conversation);
              else startNew();
            }}
          >
            <option value="">Yeni sohbet</option>
            {conversations.map((conversation) => (
              <option key={conversation.id} value={conversation.id}>
                {conversation.title}
              </option>
            ))}
          </select>
          <button
            className="button secondary"
            disabled={busy || loading}
            onClick={() => startNew()}
          >
            <Plus size={18} />
            Yeni
          </button>
        </div>
        <header className="chat-header">
          <div className="chat-agent">
            <AgentIcon icon={agent?.icon} color={agent?.color} small />
            <div>
              <label className="agent-select">
                <select
                  aria-label="Sohbet ajanı"
                  value={agentId}
                  disabled={busy || loading}
                  onChange={(e) => startNew(e.target.value)}
                >
                  {state.agents.map((a) => (
                    <option value={a.id} key={a.id}>
                      {a.name}
                      {!a.active ? " (Duraklatılmış)" : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} />
              </label>
              <small>
                <span
                  className={`status-dot ${agent?.active ? "" : "paused"}`}
                />
                {agent?.active ? "Sohbete hazır" : "Duraklatılmış"}
                <span className="dot-separator">·</span>
                {agent?.model || state.settings.model}
              </small>
            </div>
          </div>
          <div className="chat-header-actions">
            <span className="chat-source-count">
              <FileText size={14} />
              {agent?.sourceIds.length || 0} kaynak
            </span>
            {conversationId && (
              <button
                className="icon-button"
                aria-label="Geçerli sohbeti sil"
                disabled={busy || loading}
                onClick={() => setDeleteId(conversationId)}
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </header>
        {!state.settings.configured && (
          <div className="connection-notice">
            <ZapIcon />
            <span>İlk sohbetiniz için OpenAI anahtarınızı ekleyin.</span>
            <button onClick={onSettings}>
              Bağlantıyı kur
              <ArrowRight size={14} />
            </button>
          </div>
        )}
        <div
          className="messages"
          aria-label="Sohbet mesajları"
          aria-busy={busy || loading}
        >
          {loading ? (
            <div className="chat-loading">
              <LoaderCircle className="spin" />
            </div>
          ) : messages.length ? (
            messages.map((message) => (
              <article key={message.id} className={`message ${message.role}`}>
                <div className="message-avatar">
                  {message.role === "assistant" ? (
                    <AgentIcon icon={agent?.icon} color={agent?.color} small />
                  ) : (
                    <span>S</span>
                  )}
                </div>
                <div className="message-body">
                  <div className="message-label">
                    {message.role === "assistant" ? agent?.name : "Siz"}
                  </div>
                  {message.content ? (
                    <div className="markdown">
                      <Markdown
                        components={{
                          img: ({ alt }) => (
                            <span className="muted">
                              {alt ? `[Görsel: ${alt}]` : "[Görsel]"}
                            </span>
                          ),
                          a: (props) => (
                            <a
                              {...props}
                              target="_blank"
                              rel="noreferrer noopener"
                            />
                          ),
                        }}
                      >
                        {message.content}
                      </Markdown>
                    </div>
                  ) : (
                    <span className="thinking">
                      <i />
                      <i />
                      <i />
                    </span>
                  )}
                  {message.role === "assistant" &&
                    message.content &&
                    message.id !== "pending-assistant" && (
                      <button
                        className="copy-button"
                        aria-label="Yanıtı kopyala"
                        onClick={() => void copy(message)}
                      >
                        {copied === message.id ? (
                          <Check size={13} />
                        ) : (
                          <Copy size={13} />
                        )}{" "}
                        {copied === message.id ? "Kopyalandı" : "Kopyala"}
                      </button>
                    )}
                </div>
              </article>
            ))
          ) : (
            <div className="chat-welcome">
              <div className="welcome-icon">
                <AgentIcon icon={agent?.icon} color={agent?.color} />
                <span>✳</span>
              </div>
              <div className="eyebrow">BİRLİKTE DAHA FAZLASI MÜMKÜN</div>
              <h1>Bugün ne üzerinde çalışalım?</h1>
              <p>
                {agent?.description ||
                  "İşletmenizi tanıyan ajanınız, yardımcı olmaya hazır."}
              </p>
              <div className="suggestion-grid">
                {(agent?.icon === "pen"
                  ? [
                      "Markam için bir haftalık içerik planı hazırla.",
                      "Yeni ürünüm için bir tanıtım metni yaz.",
                      "Hedef kitleme uygun üç içerik fikri öner.",
                    ]
                  : agent?.icon === "trend"
                    ? [
                        "Ürünlerim için bir satış konuşması hazırla.",
                        "Müşterilerime hangi soruları sormalıyım?",
                        "İşletmemin değer önerisini birlikte yazalım.",
                      ]
                    : [
                        "İşletmem hakkında kısa bir özet hazırla.",
                        "Bir müşteri sorusunu birlikte yanıtlayalım.",
                        "Sık sorulan sorular listesi oluşturalım.",
                      ]
                ).map((text) => (
                  <button
                    disabled={busy || !agent?.active}
                    key={text}
                    onClick={() => {
                      setDraft(text);
                      input.current?.focus();
                    }}
                  >
                    {text}
                    <ArrowUp size={15} />
                  </button>
                ))}
              </div>
            </div>
          )}
          <div ref={bottom} />
        </div>
        <div className="composer-area">
          {error && (
            <p className="form-error chat-error" role="alert">
              {error}
            </p>
          )}
          <form className="composer" onSubmit={(e) => void send(e)}>
            <textarea
              ref={input}
              aria-label="Mesajınız"
              placeholder={
                state.settings.configured
                  ? `${agent?.name || "Ajanınıza"} bir mesaj yazın…`
                  : "Başlamak için OpenAI bağlantısını kurun…"
              }
              value={draft}
              maxLength={8000}
              rows={2}
              disabled={!agent?.active || loading || busy}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={keyDown}
            />
            <div className="composer-bottom">
              <span>
                <ShieldCheck size={13} />
                İşletmenizin bilgisiyle yanıtlar.
              </span>
              {busy ? (
                <button
                  type="button"
                  className="send-button stop"
                  aria-label="Yanıtı durdur"
                  onClick={() => controller.current?.abort()}
                >
                  <Square size={15} fill="currentColor" />
                </button>
              ) : (
                <button
                  type="submit"
                  className="send-button"
                  aria-label="Mesaj gönder"
                  disabled={
                    !draft.trim() ||
                    !state.settings.configured ||
                    !agent?.active ||
                    loading
                  }
                >
                  <ArrowUp size={20} />
                </button>
              )}
            </div>
          </form>
          <p className="composer-note">
            Yapay zekâ hata yapabilir. Önemli bilgileri kontrol edin.{" "}
            <span>Enter gönderir · Shift + Enter yeni satır</span>
          </p>
        </div>
      </section>
      {deleteId && (
        <Modal
          title="Sohbet silinsin mi?"
          onClose={() => setDeleteId(undefined)}
        >
          <div className="form-body">
            <p>Bu sohbetin tüm mesajları kalıcı olarak silinecek.</p>
          </div>
          <div className="modal-foot">
            <button
              className="button secondary"
              onClick={() => setDeleteId(undefined)}
            >
              Vazgeç
            </button>
            <button
              className="button destructive"
              onClick={() => void remove()}
            >
              Sohbeti sil
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
function ZapIcon() {
  return <Settings2 size={17} />;
}
