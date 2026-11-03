import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Download,
  Ellipsis,
  FileText,
  FolderOpen,
  LayoutDashboard,
  LoaderCircle,
  Menu,
  MessageSquare,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Workflow,
  X,
  Zap,
  Building2,
  Pencil,
  ExternalLink,
  KeyRound,
} from "lucide-react";
import type { Agent, AppState, Business, Page, Source } from "../shared";
import { api, json } from "./api";
import {
  AgentIcon,
  Empty,
  Modal,
  SectionTitle,
  TextLink,
  formatDate,
} from "./components/ui";
import { AgentForm, SourceForm } from "./components/forms";
const Chat = lazy(() => import("./components/Chat"));

const nav: { page: Page; label: string; icon: typeof Bot }[] = [
  { page: "overview", label: "Genel bakış", icon: LayoutDashboard },
  { page: "agents", label: "Ajanlarım", icon: Bot },
  { page: "knowledge", label: "Bilgi bankası", icon: BookOpen },
  { page: "business", label: "İşletmem", icon: Building2 },
  { page: "chat", label: "Sohbet alanı", icon: MessageSquare },
];
const titles: Record<Page, string> = {
  overview: "Genel bakış",
  agents: "Ajanlarım",
  knowledge: "Bilgi bankası",
  business: "İşletmem",
  chat: "Sohbet alanı",
  settings: "Ayarlar",
};
export default function App() {
  const [state, setState] = useState<AppState | null>(null),
    [error, setError] = useState(""),
    [page, setPage] = useState<Page>("overview"),
    [mobile, setMobile] = useState(false);
  const [agentModal, setAgentModal] = useState<Agent | "new" | null>(null),
    [sourceModal, setSourceModal] = useState<Source | "new" | null>(null),
    [deleteTarget, setDeleteTarget] = useState<{
      kind: "agents" | "sources";
      id: string;
      name: string;
    } | null>(null),
    [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState(""),
    [chatAgent, setChatAgent] = useState<string>(),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [help, setHelp] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const menuToggleRef = useRef<HTMLButtonElement>(null);
  const refresh = useCallback(async () => {
    const next = await api<AppState>("/state");
    setState(next);
    setError("");
  }, []);
  useEffect(() => {
    void refresh().catch((e) => setError(e.message));
  }, [refresh]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!mobile) return;
    const sidebar = sidebarRef.current;
    if (!sidebar) return;
    const controls = () =>
      Array.from(
        sidebar.querySelectorAll<HTMLElement>("a[href], button:not(:disabled)"),
      ).filter((element) => element.getClientRects().length > 0);
    controls()[0]?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function keyboard(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobile(false);
      }
      if (event.key !== "Tab") return;
      const items = controls(),
        first = items[0],
        last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener("keydown", keyboard);
    return () => {
      document.removeEventListener("keydown", keyboard);
      document.body.style.overflow = previousOverflow;
      menuToggleRef.current?.focus();
    };
  }, [mobile]);
  function go(next: Page) {
    setPage(next);
    setMobile(false);
    setQuery("");
    setFilter("all");
  }
  function chat(agent: Agent) {
    setChatAgent(agent.id);
    go("chat");
  }
  async function remove() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api(`/${deleteTarget.kind}/${deleteTarget.id}`, {
        method: "DELETE",
      });
      await refresh();
      setDeleteTarget(null);
      setToast("Silindi.");
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setDeleting(false);
    }
  }
  if (!state)
    return (
      <div className="loading-screen">
        <div className="brand-mark">a</div>
        {error ? (
          <>
            <h2>Sunucuya bağlanılamadı</h2>
            <p>{error}</p>
            <button
              className="button primary"
              onClick={() => void refresh().catch((e) => setError(e.message))}
            >
              Tekrar dene
            </button>
          </>
        ) : (
          <>
            <LoaderCircle className="spin" />
            <p>Çalışma alanınız hazırlanıyor…</p>
          </>
        )}
      </div>
    );
  const businessReady = Boolean(
      state.business.name && state.business.description,
    ),
    active = state.agents.filter((a) => a.active).length;
  const steps = [
    {
      title: "İşletmenizi tanıtın",
      text: "Ajanlarınız sizi daha iyi tanısın.",
      done: businessReady,
      page: "business" as Page,
    },
    {
      title: "Bilgi kaynaklarınızı ekleyin",
      text: "Doğru bilgi, daha iyi yanıtlar.",
      done: state.sources.length > 0,
      page: "knowledge" as Page,
    },
    {
      title: "OpenAI bağlantısını kurun",
      text: "Ajanlarınızı çalışmaya başlatın.",
      done: state.settings.configured,
      page: "settings" as Page,
    },
  ];
  const completed = steps.filter((s) => s.done).length;
  const filtered = state.agents.filter(
    (a) =>
      (filter === "all" || (filter === "active" ? a.active : !a.active)) &&
      `${a.name} ${a.description}`
        .toLocaleLowerCase("tr")
        .includes(query.toLocaleLowerCase("tr")),
  );
  return (
    <div className="app-shell">
      <a href="#workspace-main" className="skip-link">
        İçeriğe geç
      </a>
      {mobile && (
        <button
          className="sidebar-overlay"
          aria-label="Menüyü kapat"
          onClick={() => setMobile(false)}
        />
      )}
      <aside
        ref={sidebarRef}
        id="workspace-navigation"
        className={`sidebar ${mobile ? "open" : ""}`}
        aria-label="Çalışma alanı menüsü"
        role={mobile ? "dialog" : undefined}
        aria-modal={mobile || undefined}
      >
        <a
          href="#"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            go("overview");
          }}
        >
          <span className="brand-mark">a</span>avenlyo
          <span className="brand-period">.</span>
        </a>
        <button className="workspace" onClick={() => go("business")}>
          <span className="workspace-avatar">
            {state.business.name.slice(0, 1).toLocaleUpperCase("tr") || "İ"}
          </span>
          <span>
            <strong>{state.business.name || "Çalışma alanım"}</strong>
            <small>Kişisel çalışma alanı</small>
          </span>
          <ChevronDown size={15} />
        </button>
        <div className="nav-caption">ÇALIŞMA ALANI</div>
        <nav aria-label="Ana menü">
          {nav.map(({ page: p, label, icon: Icon }) => (
            <button
              key={p}
              className={`nav-item ${page === p ? "active" : ""}`}
              aria-current={page === p ? "page" : undefined}
              onClick={() => go(p)}
            >
              <Icon size={19} />
              <span>{label}</span>
              {p === "agents" && <b>{state.agents.length}</b>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-card">
            <span className="local-card-icon">
              <ShieldCheck size={18} />
            </span>
            <strong>Alanınız, kontrolünüz.</strong>
            <p>
              Verileriniz bu bilgisayarda.
              <br />
              Yapay zekâ, sizin yanınızda.
            </p>
            <span className="local-pill">
              <i /> Yerel çalışma alanı
            </span>
          </div>
          <button
            className={`nav-item ${page === "settings" ? "active" : ""}`}
            onClick={() => go("settings")}
          >
            <Settings2 size={19} />
            <span>Ayarlar</span>
            {!state.settings.configured && <i className="attention-dot" />}
          </button>
          <button className="nav-item" onClick={() => setHelp(true)}>
            <CircleHelp size={19} />
            <span>Başlangıç rehberi</span>
            <ArrowUpRight size={15} />
          </button>
          <div className="sidebar-user">
            <span className="user-avatar">
              {state.business.name.slice(0, 1).toLocaleUpperCase("tr") || "İ"}
            </span>
            <span>
              <strong>{state.business.name || "İşletme sahibi"}</strong>
              <small>Yerel hesap</small>
            </span>
            <span className="version">MVP</span>
          </div>
        </div>
      </aside>
      <div className="main-shell" inert={mobile}>
        <header className="topbar">
          <div className="breadcrumb">
            <button
              ref={menuToggleRef}
              className="icon-button mobile-menu"
              aria-label="Menüyü aç"
              aria-expanded={mobile}
              aria-controls="workspace-navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={22} />
            </button>
            <span>Çalışma alanı</span>
            <ChevronRight size={14} />
            <strong>{titles[page]}</strong>
          </div>
          <div className="topbar-right">
            <span className="local-status">
              <span />
              Yerel ortam
            </span>
            <span className="topbar-divider" />
            <button
              className="top-avatar"
              title="İşletme profili"
              aria-label="İşletme profili"
              onClick={() => go("business")}
            >
              {state.business.name.slice(0, 1).toLocaleUpperCase("tr") || "İ"}
            </button>
          </div>
        </header>
        <main
          id="workspace-main"
          tabIndex={-1}
          className={`main-content ${page === "chat" ? "chat-main" : ""}`}
        >
          {page === "overview" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">
                    <span /> DAHA AZ İŞ YÜKÜ, DAHA FAZLA OLASILIK
                  </div>
                  <h1>
                    Merhaba, hoş geldiniz <span className="wave">✳</span>
                  </h1>
                  <p>İşinizi anlayan ajanlarınızla, önemli olana odaklanın.</p>
                </div>
                <button
                  className="button primary"
                  onClick={() => setAgentModal("new")}
                >
                  <Plus size={18} />
                  Yeni ajan oluştur
                </button>
              </div>
              <section className="hero">
                <div className="hero-copy">
                  <span className="hero-label">
                    <Sparkles size={14} /> İŞİNİZ İÇİN BİRLİKTE ÇALIŞAN ZEKÂ
                  </span>
                  <h2>
                    Küçük ekibiniz.
                    <br />
                    <span>Büyük potansiyeliniz.</span>
                  </h2>
                  <p>
                    İşletmenizi tanıtın. Ajanlarınıza bir görev verin.
                    <br />
                    Fikirden günlük işlere, kendi yapay zekâ ekibinizi kurun.
                  </p>
                  <button
                    className="button dark"
                    onClick={() => go(businessReady ? "agents" : "business")}
                  >
                    {businessReady ? "Ajanlarımı keşfet" : "İşletmemi tanıt"}
                    <ArrowRight size={16} />
                  </button>
                  <span className="hero-note">
                    Sizin bilginizle, sizin çalışma şeklinizle.
                  </span>
                </div>
                <div className="hero-art" aria-hidden="true">
                  <div className="orbit orbit-one" />
                  <div className="orbit orbit-two" />
                  <div className="orbit-core">
                    <Workflow size={44} strokeWidth={1.4} />
                  </div>
                  <div className="orbit-tile tile-one">
                    <AgentIcon icon="headphones" color="purple" />
                    <div>
                      <strong>Destek</strong>
                      <span>Her soruya bir çözüm.</span>
                    </div>
                    <span className="tile-dot" />
                  </div>
                  <div className="orbit-tile tile-two">
                    <AgentIcon icon="pen" color="orange" />
                    <div>
                      <strong>İçerik</strong>
                      <span>Bir fikirle başlar.</span>
                    </div>
                    <Sparkles size={15} />
                  </div>
                  <div className="orbit-tile tile-three">
                    <AgentIcon icon="trend" color="green" />
                    <div>
                      <strong>Satış</strong>
                      <span>Yeni fırsatlara açık.</span>
                    </div>
                    <span className="tile-dot" />
                  </div>
                  <span className="art-spark spark-one">✳</span>
                  <span className="art-spark spark-two">+</span>
                  <span className="art-spark spark-three">+</span>
                </div>
              </section>
              <div className="stats-grid">
                {[
                  {
                    label: "Toplam ajan",
                    value: state.agents.length,
                    note: `${active} ajan kullanıma hazır`,
                    icon: Bot,
                    color: "purple",
                  },
                  {
                    label: "Bilgi kaynağı",
                    value: state.sources.length,
                    note: state.sources.length
                      ? "Ajanlarınızın ortak bilgi alanı"
                      : "İşletme bilginizle güçlendirin",
                    icon: BookOpen,
                    color: "orange",
                  },
                  {
                    label: "Sohbet",
                    value: state.conversations.length,
                    note: state.conversations.length
                      ? "Her konuşmada yeni bir fikir"
                      : "İlk konuşmanızı başlatın",
                    icon: MessageSquare,
                    color: "green",
                  },
                ].map((stat) => (
                  <div className="stat-card" key={stat.label}>
                    <div>
                      <span>{stat.label}</span>
                      <strong>{stat.value.toString().padStart(2, "0")}</strong>
                      <small>{stat.note}</small>
                    </div>
                    <span className={`stat-icon ${stat.color}`}>
                      <stat.icon size={21} strokeWidth={1.6} />
                    </span>
                  </div>
                ))}
              </div>
              <div className="overview-grid">
                <section>
                  <SectionTitle
                    title="Ajanlarınız"
                    subtitle="İşinize yardımcı olmaya hazırlar."
                    action={
                      <TextLink onClick={() => go("agents")}>
                        Tümünü gör
                      </TextLink>
                    }
                  />
                  <div className="agent-grid overview-agents">
                    {state.agents.slice(0, 3).map((agent) => (
                      <AgentCard
                        key={agent.id}
                        agent={agent}
                        sources={state.sources.length}
                        onChat={() => chat(agent)}
                        onEdit={() => setAgentModal(agent)}
                        onDelete={() =>
                          setDeleteTarget({
                            kind: "agents",
                            id: agent.id,
                            name: agent.name,
                          })
                        }
                      />
                    ))}
                  </div>
                  {!state.agents.length && (
                    <Empty
                      icon={<Bot />}
                      title="İlk çalışma arkadaşınızı oluşturun"
                      description="Ajanınıza bir isim ve görev vererek başlayın."
                      action={
                        <button
                          className="button primary"
                          onClick={() => setAgentModal("new")}
                        >
                          <Plus size={16} />
                          Ajan oluştur
                        </button>
                      }
                    />
                  )}
                </section>
                <section className="setup-card">
                  <div className="setup-top">
                    <span className="setup-icon">
                      <Zap size={19} />
                    </span>
                    <span>{completed}/3 tamamlandı</span>
                  </div>
                  <h2>İyi bir başlangıç yapalım.</h2>
                  <p>
                    Birkaç küçük adımla ajanlarınız
                    <br />
                    işletmenizi daha iyi tanısın.
                  </p>
                  <div className="progress-track">
                    <div style={{ width: `${(completed / 3) * 100}%` }} />
                  </div>
                  <div className="setup-steps">
                    {steps.map((step, i) => (
                      <button key={step.title} onClick={() => go(step.page)}>
                        <span
                          className={`step-number ${step.done ? "done" : ""}`}
                        >
                          {step.done ? <Check size={13} /> : i + 1}
                        </span>
                        <span>
                          <strong>{step.title}</strong>
                          <small>{step.text}</small>
                        </span>
                        <ChevronRight size={15} />
                      </button>
                    ))}
                  </div>
                </section>
              </div>
              <div className="bottom-note">
                <span>
                  <ShieldCheck size={15} /> Kontrol sizde. Ajanlar ve sohbetler
                  bu bilgisayarda saklanır.
                </span>
                <a
                  href="https://github.com/ismet3547/avenlyo-mvp"
                  target="_blank"
                  rel="noreferrer"
                >
                  Avenlyo MVP <ArrowUpRight size={13} />
                </a>
              </div>
            </>
          )}
          {page === "agents" && (
            <>
              <PageHeading
                eyebrow="YAPAY ZEKÂ EKİBİNİZ"
                title="Her görev için doğru ajan."
                description="Kendi çalışma arkadaşlarınızı oluşturun, yönetin ve geliştirin."
                action={
                  <button
                    className="button primary"
                    onClick={() => setAgentModal("new")}
                  >
                    <Plus size={18} />
                    Yeni ajan oluştur
                  </button>
                }
              />
              <div className="toolbar">
                <div className="tabs">
                  {[
                    ["all", "Tüm ajanlar"],
                    ["active", "Aktif"],
                    ["paused", "Duraklatılmış"],
                  ].map(([v, label]) => (
                    <button
                      className={filter === v ? "selected" : ""}
                      key={v}
                      onClick={() => setFilter(v)}
                    >
                      {label}
                      {v === "all" && <span>{state.agents.length}</span>}
                    </button>
                  ))}
                </div>
                <SearchInput
                  value={query}
                  onChange={setQuery}
                  placeholder="Ajan ara…"
                />
              </div>
              {filtered.length ? (
                <div className="agent-grid full-agents">
                  {filtered.map((agent) => (
                    <AgentCard
                      key={agent.id}
                      agent={agent}
                      sources={state.sources.length}
                      onChat={() => chat(agent)}
                      onEdit={() => setAgentModal(agent)}
                      onDelete={() =>
                        setDeleteTarget({
                          kind: "agents",
                          id: agent.id,
                          name: agent.name,
                        })
                      }
                    />
                  ))}
                </div>
              ) : (
                <Empty
                  icon={<Bot />}
                  title={
                    query ? "Ajan bulunamadı" : "Burada yeni bir ekip başlıyor"
                  }
                  description={
                    query
                      ? "Farklı bir arama veya filtre deneyin."
                      : "İlk ajanınızı oluşturup ona bir görev verin."
                  }
                  action={
                    <button
                      className="button primary"
                      onClick={() => setAgentModal("new")}
                    >
                      Ajan oluştur
                    </button>
                  }
                />
              )}
              <div className="info-strip">
                <Sparkles size={18} />
                <p>
                  <strong>Küçük bir ipucu:</strong> Talimatlarda ajanın rolünü,
                  hedefini ve yanıt dilini açıkça belirtin. İyi bir başlangıç,
                  iyi bir talimatla olur.
                </p>
              </div>
            </>
          )}
          {page === "knowledge" && (
            <>
              <PageHeading
                eyebrow="BİLGİDEN GÜCE"
                title="İşletmenizin ortak hafızası."
                description="Ajanlarınızı doğru bilgilerle besleyin. Ürünler, süreçler, sık sorulan sorular…"
                action={
                  <button
                    className="button primary"
                    onClick={() => setSourceModal("new")}
                  >
                    <Plus size={18} />
                    Kaynak ekle
                  </button>
                }
              />
              <div className="knowledge-banner">
                <span className="knowledge-illustration">
                  <BookOpen size={34} strokeWidth={1.4} />
                </span>
                <div>
                  <h3>Bilginiz, ajanlarınızın en güçlü yanı.</h3>
                  <p>
                    Metin yazın veya TXT / Markdown dosyası yükleyin. Ardından
                    ilgili ajanlara atayın.
                  </p>
                </div>
                <span className="count-pill">
                  {state.sources.length} kaynak
                </span>
              </div>
              <div className="toolbar">
                <h2 className="toolbar-title">
                  Tüm kaynaklar <span>{state.sources.length}</span>
                </h2>
                <SearchInput
                  value={query}
                  onChange={setQuery}
                  placeholder="Kaynak ara…"
                />
              </div>
              {state.sources.length ? (
                <div className="source-list">
                  {state.sources
                    .filter((s) =>
                      `${s.title} ${s.content}`
                        .toLocaleLowerCase("tr")
                        .includes(query.toLocaleLowerCase("tr")),
                    )
                    .map((source) => (
                      <article key={source.id} className="source-row">
                        <span className="source-icon">
                          <FileText size={22} />
                        </span>
                        <button
                          className="source-content"
                          onClick={() => setSourceModal(source)}
                        >
                          <strong>{source.title}</strong>
                          <span>{source.content.slice(0, 120)}</span>
                          <small>
                            {source.category} <i />{" "}
                            {source.content.length.toLocaleString("tr-TR")}{" "}
                            karakter <i />{" "}
                            {
                              state.agents.filter((a) =>
                                a.sourceIds.includes(source.id),
                              ).length
                            }{" "}
                            ajana atanmış
                          </small>
                        </button>
                        <span className="source-date">
                          {formatDate(source.updatedAt)}
                        </span>
                        <button
                          className="icon-button"
                          aria-label={`${source.title} düzenle`}
                          onClick={() => setSourceModal(source)}
                        >
                          <Pencil size={17} />
                        </button>
                        <button
                          className="icon-button danger"
                          aria-label={`${source.title} sil`}
                          onClick={() =>
                            setDeleteTarget({
                              kind: "sources",
                              id: source.id,
                              name: source.title,
                            })
                          }
                        >
                          <Trash2 size={17} />
                        </button>
                      </article>
                    ))}
                  {query &&
                    !state.sources.some((s) =>
                      `${s.title} ${s.content}`
                        .toLocaleLowerCase("tr")
                        .includes(query.toLocaleLowerCase("tr")),
                    ) && (
                      <Empty
                        icon={<Search />}
                        title="Kaynak bulunamadı"
                        description="Başka bir kelimeyle aramayı deneyin."
                      />
                    )}
                </div>
              ) : (
                <Empty
                  icon={<FolderOpen size={30} />}
                  title="Bilgi bankanız sizi bekliyor"
                  description="Ürün kataloğu, iade koşulları veya bir marka rehberi… İlk kaynağınızı ekleyin."
                  action={
                    <button
                      className="button primary"
                      onClick={() => setSourceModal("new")}
                    >
                      <Plus size={17} />
                      İlk kaynağı ekle
                    </button>
                  }
                />
              )}
            </>
          )}
          {page === "business" && (
            <BusinessPage
              value={state.business}
              refresh={refresh}
              notify={setToast}
            />
          )}
          {page === "settings" && (
            <SettingsPage state={state} refresh={refresh} notify={setToast} />
          )}
          {page === "chat" && (
            <Suspense
              fallback={
                <div className="chat-loading">
                  <LoaderCircle className="spin" />
                </div>
              }
            >
              <Chat
                state={state}
                initialAgent={chatAgent}
                refresh={refresh}
                onSettings={() => go("settings")}
              />
            </Suspense>
          )}
        </main>
      </div>
      {agentModal && (
        <AgentForm
          agent={agentModal === "new" ? undefined : agentModal}
          sources={state.sources}
          onClose={() => setAgentModal(null)}
          onSaved={refresh}
          notify={setToast}
        />
      )}
      {sourceModal && (
        <SourceForm
          source={sourceModal === "new" ? undefined : sourceModal}
          onClose={() => setSourceModal(null)}
          onSaved={refresh}
          notify={setToast}
        />
      )}
      {deleteTarget && (
        <Modal
          title="Silmek istediğinize emin misiniz?"
          onClose={() => setDeleteTarget(null)}
        >
          <div className="form-body">
            <p>
              <strong>{deleteTarget.name}</strong> silinecek.{" "}
              {deleteTarget.kind === "agents"
                ? "Bu ajanın sohbet geçmişi de silinir."
                : "Kaynak, atandığı ajanlardan da kaldırılır."}{" "}
              Bu işlem geri alınamaz.
            </p>
          </div>
          <div className="modal-foot">
            <button
              className="button secondary"
              onClick={() => setDeleteTarget(null)}
            >
              Vazgeç
            </button>
            <button
              className="button destructive"
              disabled={deleting}
              onClick={() => void remove()}
            >
              {deleting ? "Siliniyor…" : "Evet, sil"}
            </button>
          </div>
        </Modal>
      )}
      {help && (
        <Modal
          title="Avenlyo’ya hoş geldiniz."
          subtitle="Kendi yapay zekâ ekibinize üç adımda başlayın."
          onClose={() => setHelp(false)}
        >
          <div className="form-body guide">
            <p>
              <b>1. İşletmenizi tanıtın.</b> İşletmem sayfasından ürünlerinizi,
              hedef kitlenizi ve marka dilinizi ekleyin.
            </p>
            <p>
              <b>2. Ajanınızı hazırlayın.</b> Hazır ajanları düzenleyin veya
              yeni ajan oluşturun. Bilgi bankasına eklediğiniz kaynakları ilgili
              ajanlara atayın.
            </p>
            <p>
              <b>3. Bağlanın ve konuşun.</b> Ayarlar’dan OpenAI anahtarınızı
              ekleyin, ardından Sohbet alanı’nda ajanınızı deneyin.
            </p>
            <div className="notice">
              <ShieldCheck size={18} />
              <p>
                Veriler yerel olarak saklanır. Yanıt üretmek için işletme
                profiliniz, atanmış kaynaklar ve ilgili sohbet mesajları
                OpenAI’a gönderilir. API kullanımı OpenAI hesabınıza
                ücretlendirilir.
              </p>
            </div>
          </div>
          <div className="modal-foot">
            <button
              className="button primary"
              onClick={() => {
                setHelp(false);
                go("business");
              }}
            >
              Hadi başlayalım
              <ArrowRight size={16} />
            </button>
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          <span>{toast}</span>
          <button aria-label="Bildirimi kapat" onClick={() => setToast("")}>
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="search-input">
      <Search size={17} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button
          type="button"
          aria-label="Aramayı temizle"
          onClick={() => onChange("")}
        >
          <X size={14} />
        </button>
      )}
    </label>
  );
}
function AgentCard({
  agent,
  onChat,
  onEdit,
  onDelete,
}: {
  agent: Agent;
  sources: number;
  onChat: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <article className="agent-card">
      <div className="agent-card-top">
        <AgentIcon icon={agent.icon} color={agent.color} />
        <div className="card-menu">
          <button
            ref={triggerRef}
            className="icon-button"
            aria-label={`${agent.name} seçenekleri`}
            aria-expanded={menu}
            onKeyDown={(event) => {
              if (event.key === "Escape") setMenu(false);
            }}
            onClick={() => setMenu(!menu)}
          >
            <Ellipsis size={20} />
          </button>
          {menu && (
            <>
              <button
                className="menu-dismiss"
                aria-label="Seçenekleri kapat"
                onClick={() => setMenu(false)}
              />
              <div
                className="dropdown"
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setMenu(false);
                    triggerRef.current?.focus();
                  }
                }}
              >
                <button
                  onClick={() => {
                    setMenu(false);
                    onEdit();
                  }}
                >
                  <Pencil size={15} />
                  Düzenle
                </button>
                <button
                  className="danger"
                  onClick={() => {
                    setMenu(false);
                    onDelete();
                  }}
                >
                  <Trash2 size={15} />
                  Sil
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <h3>{agent.name}</h3>
      <p>{agent.description || "İşletmenizin yeni yapay zekâ yardımcısı."}</p>
      <div className="agent-meta">
        <span className={`agent-status ${!agent.active ? "paused" : ""}`}>
          <i />
          {agent.active ? "Aktif" : "Duraklatıldı"}
        </span>
        <span>
          <FileText size={13} />
          {agent.sourceIds.length} kaynak
        </span>
      </div>
      <button className="agent-chat" onClick={onChat} disabled={!agent.active}>
        Sohbet başlat
        <ArrowUpRight size={17} />
      </button>
    </article>
  );
}

function BusinessPage({
  value,
  refresh,
  notify,
}: {
  value: Business;
  refresh: () => Promise<void>;
  notify: (v: string) => void;
}) {
  const [form, setForm] = useState(value),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/business", { method: "PUT", body: json(form) });
      await refresh();
      notify("İşletme profiliniz güncellendi.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="HER ŞEY SİZİ TANIMAKLA BAŞLAR"
        title="İşletmenizi birlikte tanıyalım."
        description="Bu profil, tüm ajanlarınızın işletmenizi ve marka dilinizi anlamasını sağlar."
      />
      <div className="settings-layout">
        <form className="panel business-form" onSubmit={save}>
          <SectionTitle
            title="İşletme profili"
            subtitle="Kısa ve güncel bilgiler en iyi sonucu verir."
          />
          <div className="form-grid">
            <label>
              İşletme adı <span>*</span>
              <input
                required
                maxLength={100}
                placeholder="Örn. Avenlyo Studio"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label>
              Sektör
              <input
                maxLength={100}
                placeholder="Örn. E-ticaret, danışmanlık"
                value={form.industry}
                onChange={(e) => setForm({ ...form, industry: e.target.value })}
              />
            </label>
          </div>
          <label>
            İşletmenizi anlatın <span>*</span>
            <textarea
              required
              rows={4}
              maxLength={12000}
              placeholder="Ne yapıyorsunuz? Sizi farklı kılan ne?"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </label>
          <label>
            Ürün ve hizmetler
            <textarea
              rows={3}
              maxLength={12000}
              placeholder="Neler sunuyorsunuz? Temel özellikler ve fiyat bilgileri…"
              value={form.products}
              onChange={(e) => setForm({ ...form, products: e.target.value })}
            />
          </label>
          <label>
            Hedef kitleniz
            <textarea
              rows={2}
              maxLength={4000}
              placeholder="Kimlere yardımcı oluyorsunuz?"
              value={form.audience}
              onChange={(e) => setForm({ ...form, audience: e.target.value })}
            />
          </label>
          <div className="form-grid">
            <label>
              Marka dili
              <select
                value={form.tone}
                onChange={(e) => setForm({ ...form, tone: e.target.value })}
              >
                {[
                  "Samimi ve profesyonel",
                  "Resmî ve kurumsal",
                  "Yaratıcı ve enerjik",
                  "Sade ve doğrudan",
                ].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              Web sitesi
              <input
                type="url"
                maxLength={300}
                placeholder="https://isletmeniz.com"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
              />
            </label>
          </div>
          <small className="muted">
            Web sitesi referans olarak saklanır; içerik otomatik olarak okunmaz.
          </small>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <button className="button primary" disabled={busy}>
              {busy ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <Check size={16} />
              )}
              Profili kaydet
            </button>
          </div>
        </form>
        <aside className="tip-card">
          <span className="tip-symbol">✳</span>
          <h3>
            Sizi tanıyan ajanlar,
            <br />
            size benzeyen yanıtlar.
          </h3>
          <p>
            İşletme profiliniz her sohbette ajanlarınıza aktarılır. Bir kez
            güncelleyin, tüm ekibiniz aynı bilgiyle çalışsın.
          </p>
          <div className="tip-divider" />
          <h4>İyi bir profil için</h4>
          <p>
            Ne yaptığınızı açıkça anlatın. Hedef kitlenizi belirtin.
            Müşterilerinizle nasıl konuştuğunuzu tarif edin.
          </p>
        </aside>
      </div>
    </>
  );
}

function SettingsPage({
  state,
  refresh,
  notify,
}: {
  state: AppState;
  refresh: () => Promise<void>;
  notify: (v: string) => void;
}) {
  const [key, setKey] = useState(""),
    [model, setModel] = useState(state.settings.model),
    [busy, setBusy] = useState(false),
    [testing, setTesting] = useState(false),
    [error, setError] = useState("");
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/settings", {
        method: "PUT",
        body: json({ apiKey: key || undefined, model }),
      });
      setKey("");
      await refresh();
      notify("Bağlantı ayarları kaydedildi.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function test() {
    setTesting(true);
    setError("");
    try {
      await api("/settings/test", {
        method: "POST",
        body: json({ apiKey: key || undefined, model }),
      });
      notify("OpenAI bağlantısı ve model erişimi doğrulandı.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setTesting(false);
    }
  }
  async function exportData() {
    try {
      const data = await api("/export");
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `avenlyo-yedek-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      notify("Veriler dışa aktarıldı.");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="KONTROL SİZDE"
        title="Çalışma alanı ayarları."
        description="OpenAI bağlantınızı ve yerel verilerinizi buradan yönetin."
      />
      <div className="settings-layout">
        <div>
          <form className="panel" onSubmit={save}>
            <SectionTitle
              title="OpenAI bağlantısı"
              subtitle="Anahtarınız tarayıcıya geri gönderilmez."
              action={
                <span
                  className={`connection-badge ${state.settings.configured ? "connected" : ""}`}
                >
                  <i />
                  {state.settings.configured
                    ? "Anahtar tanımlı"
                    : "Bağlantı bekleniyor"}
                </span>
              }
            />
            <label>
              API anahtarı
              <input
                type="password"
                autoComplete="new-password"
                placeholder={
                  state.settings.configured
                    ? "Yeni anahtar girmek için buraya yazın"
                    : "sk-…"
                }
                value={key}
                onChange={(e) => setKey(e.target.value)}
                maxLength={512}
              />
              <small>
                {state.settings.keySource === "environment"
                  ? "Ortam değişkenindeki anahtar kullanılıyor."
                  : state.settings.configured
                    ? "Kaydedilmiş anahtar kullanılıyor. Boş bırakırsanız korunur."
                    : "Anahtarınızı OpenAI platformundan alabilirsiniz."}
              </small>
            </label>
            <label>
              Varsayılan model
              <input
                required
                maxLength={100}
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="gpt-4.1-mini"
              />
              <small>
                OpenAI hesabınızın erişebildiği bir model kimliği girin. Ajan
                bazında değiştirilebilir.
              </small>
            </label>
            <div className="notice">
              <ShieldCheck size={19} />
              <p>
                Anahtar bu bilgisayardaki özel ayarlarda saklanır. Sohbet
                sırasında işletme profiliniz, atanmış kaynaklar ve ilgili
                mesajlar OpenAI’a gönderilir. API kullanımı hesabınıza
                ücretlendirilir.
              </p>
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="form-actions">
              <button
                className="button secondary"
                type="button"
                disabled={testing || (!key && !state.settings.configured)}
                onClick={() => void test()}
              >
                {testing ? (
                  <LoaderCircle className="spin" size={16} />
                ) : (
                  <Zap size={16} />
                )}
                Bağlantıyı test et
              </button>
              <button className="button primary" disabled={busy}>
                {busy ? (
                  <LoaderCircle className="spin" size={16} />
                ) : (
                  <Check size={16} />
                )}
                Kaydet
              </button>
            </div>
          </form>
          <section className="panel export-panel">
            <div>
              <h2>Verileriniz sizinle kalsın.</h2>
              <p>
                İşletme profili, ajanlar, kaynaklar ve sohbetlerinizi JSON
                olarak indirin. API anahtarınız dahil edilmez.
              </p>
            </div>
            <button
              className="button secondary"
              onClick={() => void exportData()}
            >
              <Download size={16} />
              Dışa aktar
            </button>
          </section>
        </div>
        <aside className="tip-card neutral">
          <KeyRound size={28} />
          <h3>
            Tek bir anahtar.
            <br />
            Kendi yapay zekâ ekibiniz.
          </h3>
          <p>
            Başlamak için OpenAI hesabınızda bir API anahtarı oluşturun.
            Kaydettikten sonra bağlantıyı test edebilirsiniz.
          </p>
          <a
            className="text-link"
            href="https://platform.openai.com/api-keys"
            target="_blank"
            rel="noreferrer"
          >
            OpenAI platformu
            <ExternalLink size={14} />
          </a>
          <div className="tip-divider" />
          <p className="small-text">
            Avenlyo yerel ve tek kullanıcılı bir MVP’dir. Uygulama varsayılan
            olarak yalnızca bu bilgisayardan erişilir.
          </p>
        </aside>
      </div>
    </>
  );
}
