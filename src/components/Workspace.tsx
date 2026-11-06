import { useEffect, useState } from "react";
import {
  BookOpen,
  Bot,
  Check,
  FlaskConical,
  Inbox,
  KeyRound,
  LogOut,
  Mail,
  MessageSquare,
  Radio,
} from "lucide-react";
import type {
  Handoff,
  InboxItem,
  InboxThread,
  Session,
  WorkspaceState,
} from "../../shared";
import { api, ApiError } from "../api";
import { Badge, Brand, CopyButton, ErrorNotice, Loading } from "./site-ui";
import { Empty, formatDate } from "./ui";
import {
  KnowledgeStep,
  PreviewStep,
  ProfileStep,
  PublishStep,
} from "./WorkspaceSetup";

const base = "/a1/workspace";
const steps = [
  {
    key: "profile",
    label: "Ajan",
    title: "Ajanınızı tanımlayın",
    description:
      "Ajanın hangi işletmeyi temsil edeceğini ve müşteriye nasıl hitap edeceğini belirleyin.",
    icon: Bot,
  },
  {
    key: "knowledge",
    label: "Bilgi",
    title: "Bilgi bankasını hazırlayın",
    description:
      "Ajanın müşterilerle paylaşabileceği bilgileri ekleyin ve onaylayın.",
    icon: BookOpen,
  },
  {
    key: "preview",
    label: "Test",
    title: "Yanıtı yayından önce deneyin",
    description:
      "Bir müşteri sorusu yazın ve yanıtın hangi kaynağa dayandığını görün.",
    icon: FlaskConical,
  },
  {
    key: "publish",
    label: "Yayın",
    title: "Müşteri sohbetini hazırlayın",
    description: "Onaylanan sürümü kapalı test bağlantısından deneyin.",
    icon: Radio,
  },
  {
    key: "inbox",
    label: "Gelen kutusu",
    title: "Sohbetler ve talepler",
    description:
      "Müşteri konuşmalarını ve geri dönüş bekleyen talepleri buradan takip edin.",
    icon: Inbox,
  },
] as const;
type Step = (typeof steps)[number]["key"];

function initialStep(state: WorkspaceState): Step {
  if (!state.profile) return "profile";
  if (state.publication) return "publish";
  if (!state.sources.some((source) => source.approved)) return "knowledge";
  return state.tested ? "publish" : "preview";
}

function InboxPanel() {
  const [items, setItems] = useState<InboxItem[] | null>(null);
  const [selected, setSelected] = useState("");
  const [thread, setThread] = useState<InboxThread | null>(null);
  const [listError, setListError] = useState("");
  const [threadError, setThreadError] = useState("");
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    const abort = new AbortController();
    void api<InboxItem[]>(base + "/inbox", { signal: abort.signal })
      .then((data) => {
        if (abort.signal.aborted) return;
        const sorted = [...data].sort(
          (a, b) =>
            Number(b.handoff?.status === "open") -
            Number(a.handoff?.status === "open"),
        );
        setItems(sorted);
        setSelected(sorted[0]?.id ?? "");
      })
      .catch((error: Error) => {
        if (!abort.signal.aborted) setListError(error.message);
      });
    return () => abort.abort();
  }, []);

  useEffect(() => {
    if (!selected) return;
    const abort = new AbortController();
    setThreadError("");
    setThread(null);
    void api<InboxThread>(base + "/inbox/" + selected, { signal: abort.signal })
      .then((data) => {
        if (!abort.signal.aborted) setThread(data);
      })
      .catch((error: Error) => {
        if (!abort.signal.aborted) setThreadError(error.message);
      });
    return () => abort.abort();
  }, [selected]);

  async function resolve() {
    if (!thread || resolving) return;
    const id = thread.id;
    setResolving(true);
    setThreadError("");
    try {
      const handoff = await api<Handoff>(base + "/inbox/" + id + "/resolve", {
        method: "POST",
      });
      setItems(
        (current) =>
          current?.map((item) =>
            item.id === id ? { ...item, handoff } : item,
          ) ?? [],
      );
      setThread((current) =>
        current?.id === id ? { ...current, handoff } : current,
      );
    } catch (error) {
      setThreadError((error as Error).message);
    } finally {
      setResolving(false);
    }
  }

  if (listError) return <ErrorNotice message={listError} />;
  if (!items) return <Loading>Sohbetler yükleniyor…</Loading>;
  if (!items.length)
    return (
      <div className="panel">
        <Empty
          icon={<Inbox />}
          title="Gelen kutunuz boş"
          description="Yayın bağlantısından gelen ilk müşteri mesajı burada görünür."
        />
      </div>
    );
  return (
    <div className="a1-inbox-grid">
      <nav className="a1-thread-list" aria-label="Sohbetler">
        {items.map((item) => (
          <button
            key={item.id}
            className="a1-thread-item"
            type="button"
            onClick={() => setSelected(item.id)}
            aria-current={selected === item.id ? "true" : undefined}
            disabled={resolving}
          >
            <strong>{item.title}</strong>
            <span>
              {formatDate(item.updatedAt)} ·{" "}
              {item.handoff?.status === "open"
                ? "Geri dönüş bekliyor"
                : item.handoff
                  ? "Çözüldü"
                  : "Sohbet"}
            </span>
          </button>
        ))}
      </nav>
      <section
        className="panel a1-stack a1-inbox-thread"
        aria-label="Sohbet ayrıntısı"
      >
        <ErrorNotice message={threadError} />
        {!thread ? (
          !threadError && <Loading>Sohbet yükleniyor…</Loading>
        ) : (
          <>
            <div className="a1-section-bar">
              <h3>{thread.title}</h3>
              {thread.handoff && (
                <Badge
                  tone={
                    thread.handoff.status === "open" ? "warning" : "success"
                  }
                >
                  {thread.handoff.status === "open" ? "Bekliyor" : "Çözüldü"}
                </Badge>
              )}
            </div>
            {thread.handoff && (
              <div className="a1-inbox-contact">
                <span>
                  <Mail size={18} /> {thread.handoff.email}
                </span>
                {thread.handoff.status === "open" && (
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => void resolve()}
                    disabled={resolving}
                  >
                    <Check size={16} />{" "}
                    {resolving ? "Kaydediliyor…" : "Çözüldü olarak işaretle"}
                  </button>
                )}
              </div>
            )}
            <ol className="a1-messages">
              {thread.messages.map((message) => (
                <li className={"a1-message " + message.role} key={message.id}>
                  <strong>
                    {message.role === "user" ? "Müşteri" : "Ajan"}
                  </strong>
                  <p>{message.content}</p>
                </li>
              ))}
            </ol>
          </>
        )}
      </section>
    </div>
  );
}

export default function Workspace() {
  const [account, setAccount] = useState<Session | null>(null);
  const [state, setState] = useState<WorkspaceState | null>(null);
  const [step, setStep] = useState<Step>("profile");
  const [error, setError] = useState("");
  const [accountError, setAccountError] = useState("");
  const [accountBusy, setAccountBusy] = useState(false);
  const [recovery, setRecovery] = useState("");

  useEffect(() => {
    const abort = new AbortController();
    void Promise.all([
      api<{ account: Session | null }>("/a1/session", { signal: abort.signal }),
      api<WorkspaceState>(base, { signal: abort.signal }),
    ])
      .then(([session, data]) => {
        if (abort.signal.aborted) return;
        if (!session.account) {
          location.replace("/giris");
          return;
        }
        setAccount(session.account);
        setState(data);
        setStep(initialStep(data));
      })
      .catch((error: Error) => {
        if (abort.signal.aborted) return;
        if (error instanceof ApiError && error.status === 401)
          location.replace("/giris");
        else setError(error.message);
      });
    return () => abort.abort();
  }, []);

  async function accountAction(action: "logout" | "recovery") {
    if (accountBusy) return;
    setAccountBusy(true);
    setAccountError("");
    try {
      if (action === "logout") {
        await api("/a1/session", { method: "DELETE" });
        location.assign("/");
      } else {
        const result = await api<{ recoveryCode: string }>(
          "/a1/session/recovery",
          { method: "POST" },
        );
        setRecovery(result.recoveryCode);
      }
    } catch (error) {
      setAccountError((error as Error).message);
    } finally {
      setAccountBusy(false);
    }
  }

  if (!account || !state)
    return (
      <main className="a1-centered">
        <Brand />
        {error ? (
          <>
            <ErrorNotice message={error} />
            <button
              type="button"
              className="button secondary"
              onClick={() => location.reload()}
            >
              Tekrar dene
            </button>
          </>
        ) : (
          <Loading>Çalışma alanınız hazırlanıyor…</Loading>
        )}
      </main>
    );

  const selected = steps.find((item) => item.key === step)!;
  const status = state.publication?.status;
  const allowed: Record<Step, boolean> = {
    profile: true,
    knowledge: Boolean(state.profile),
    preview: Boolean(
      state.profile && state.sources.some((source) => source.approved),
    ),
    publish: Boolean(state.tested || state.publication),
    inbox: true,
  };

  return (
    <div className="a1-workspace">
      <a className="skip-link" href="#a1-workspace-main">
        İçeriğe geç
      </a>
      <header className="a1-workspace-top">
        <div className="a1-container a1-topbar-inner">
          <Brand />
          <Badge>Kapalı test · A1</Badge>
          <details className="a1-account">
            <summary>Hesabım</summary>
            <div className="a1-account-card panel">
              <strong>{account.email}</strong>
              <p className="a1-muted">
                Yeni kurtarma kodu oluşturursanız önceki kodun geçerliliği sona
                erer.
              </p>
              {recovery && (
                <>
                  <output className="a1-code" aria-label="Yeni kurtarma kodu">
                    {recovery}
                  </output>
                  <CopyButton label="Kodu kopyala" value={recovery} />
                </>
              )}
              <ErrorNotice message={accountError} />
              <button
                type="button"
                className="button secondary"
                disabled={accountBusy}
                onClick={() => void accountAction("recovery")}
              >
                <KeyRound size={16} /> Yeni kurtarma kodu
              </button>
              <button
                type="button"
                className="button secondary"
                disabled={accountBusy}
                onClick={() => void accountAction("logout")}
              >
                <LogOut size={16} /> Çıkış yap
              </button>
            </div>
          </details>
        </div>
      </header>
      <main
        className="a1-container a1-workspace-main"
        id="a1-workspace-main"
        tabIndex={-1}
      >
        <div className="a1-workspace-heading">
          <div>
            <span className="a1-kicker">Çalışma alanı</span>
            <h1>{state.profile?.businessName || "İlk ajanınız"}</h1>
          </div>
          <Badge
            tone={
              status === "live"
                ? "success"
                : status === "paused"
                  ? "warning"
                  : "neutral"
            }
          >
            {status === "live"
              ? "Yayında"
              : status === "paused"
                ? "Duraklatıldı"
                : "Taslak"}
          </Badge>
        </div>
        <div className="a1-workspace-grid">
          <nav className="a1-workspace-nav" aria-label="Çalışma alanı adımları">
            {steps.map(({ key, label, icon: Icon }, index) => (
              <button
                key={key}
                type="button"
                aria-current={step === key ? "step" : undefined}
                onClick={() => setStep(key)}
                disabled={!allowed[key]}
              >
                <Icon size={19} />
                <span>
                  {index < 4 && <small>{index + 1}.</small>} {label}
                </span>
              </button>
            ))}
            <a
              className="a1-demo-link"
              href="/sohbet/demo"
              target="_blank"
              rel="noreferrer"
            >
              <MessageSquare size={17} /> Örnek sohbet
            </a>
          </nav>
          <div className="a1-workspace-content">
            <div className="a1-section-heading">
              <h2>{selected.title}</h2>
              <p>{selected.description}</p>
            </div>
            {step === "profile" && (
              <ProfileStep
                profile={state.profile}
                saved={(data) => {
                  setState(data);
                  setStep("knowledge");
                }}
              />
            )}
            {step === "knowledge" && (
              <KnowledgeStep
                state={state}
                saved={setState}
                next={() => setStep("preview")}
              />
            )}
            {step === "preview" && (
              <PreviewStep
                state={state}
                saved={setState}
                next={() => setStep("publish")}
              />
            )}
            {step === "publish" && (
              <PublishStep state={state} saved={setState} />
            )}
            {step === "inbox" && <InboxPanel />}
          </div>
        </div>
      </main>
    </div>
  );
}
