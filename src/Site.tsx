import { lazy, Suspense, useEffect, useState, type FormEvent } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Bot,
  Check,
  FlaskConical,
  Headphones,
  LifeBuoy,
  LockKeyhole,
  MessageSquare,
  Send,
  Sparkles,
} from "lucide-react";
import type { AccountCreated, Session } from "../shared";
import { api, json } from "./api";
import {
  Badge,
  Brand,
  CopyButton,
  ErrorNotice,
  Loading,
} from "./components/site-ui";
import "./a1.css";

const Workspace = lazy(() => import("./components/Workspace"));
const CustomerChat = lazy(() => import("./components/CustomerChat"));
const LocalWorkspace = lazy(() => import("./App"));

const steps = [
  {
    icon: BookOpen,
    title: "Bilgilerinizi ekleyin",
    description:
      "Sık sorulan soruları, hizmetlerinizi ve işletme kurallarınızı tek yerde toplayın.",
  },
  {
    icon: FlaskConical,
    title: "Ajanınızı deneyin",
    description:
      "Müşteri gibi bir soru sorun. Yanıtı ve hangi kaynağa dayandığını yayından önce görün.",
  },
  {
    icon: Send,
    title: "Sohbeti paylaşın",
    description:
      "Ajanı bir bağlantıyla paylaşın veya sitenize ekleyin. İlgilenmeniz gereken talepler panelinize gelsin.",
  },
];

function Landing() {
  const [account, setAccount] = useState<Session | null>(null);
  useEffect(() => {
    let cancelled = false;
    void api<{ account: Session | null }>("/a1/session")
      .then((data) => {
        if (!cancelled) setAccount(data.account);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const entry = account ? "/panel" : "/kayit";
  const action = account ? "Panele dön" : "Ajanını oluştur";
  return (
    <div className="a1-landing">
      <a className="skip-link" href="#a1-main">
        İçeriğe geç
      </a>
      <header className="a1-topbar">
        <div className="a1-container a1-topbar-inner">
          <Brand />
          <nav className="a1-site-nav" aria-label="Site menüsü">
            <a href="#nasil-calisir">Nasıl çalışır?</a>
            <a href="/sohbet/demo">Demo</a>
          </nav>
          <a href={account ? "/panel" : "/giris"} className="button secondary">
            {account ? "Çalışma alanı" : "Giriş yap"} <ArrowUpRight size={16} />
          </a>
        </div>
      </header>
      <main id="a1-main" tabIndex={-1}>
        <section className="a1-container a1-hero">
          <div className="a1-hero-copy">
            <Badge>
              <LockKeyhole size={14} /> Kapalı test · A1
            </Badge>
            <h1>
              Müşterilerinize, <em>işletmenizin bilgisiyle</em> yanıt verin.
            </h1>
            <p>
              Avenlyo ile kendi müşteri destek ajanınızı oluşturun.
              Bilgilerinizi ekleyin, yanıtları deneyin ve hazır olduğunda sohbet
              bağlantısını paylaşın.
            </p>
            <div className="a1-actions">
              <a className="button primary" href={entry}>
                {action} <ArrowRight size={18} />
              </a>
              <a className="button secondary" href="/sohbet/demo">
                <MessageSquare size={18} /> Demoyu dene
              </a>
            </div>
            <div className="a1-hero-notes">
              <span>
                <Check size={16} /> Yönlendirmeli kurulum
              </span>
              <span>
                <Check size={16} /> Kaynaklara dayalı yanıt
              </span>
            </div>
          </div>
          <div className="a1-stage">
            <div className="a1-stage-top">
              <span>
                <Sparkles size={16} /> Örnek sohbet
              </span>
              <span>01 / A1</span>
            </div>
            <div className="a1-stage-window">
              <div className="a1-stage-header">
                <span className="a1-stage-icon">
                  <Headphones size={22} />
                </span>
                <span>
                  <strong>Deniz Mobilya</strong>
                  <small>Yapay zekâ asistanı</small>
                </span>
              </div>
              <div className="a1-stage-dialogue">
                <p className="a1-example-user">Teslimat kaç gün sürer?</p>
                <p className="a1-example-answer">
                  Stoktaki ürünler 3–5 iş günü içinde kargoya verilir.
                </p>
                <span className="a1-example-source">
                  <BookOpen size={15} /> Teslimat bilgisi
                </span>
              </div>
              <a href="/sohbet/demo" className="a1-stage-link">
                Bu sohbeti dene <ArrowUpRight size={17} />
              </a>
            </div>
            <p className="a1-stage-note">
              <LifeBuoy size={17} /> Yanıt bulunamazsa müşteri ekibe talep
              bırakabilir.
            </p>
          </div>
        </section>
        <section className="a1-how" id="nasil-calisir">
          <div className="a1-container">
            <div className="a1-section-heading">
              <span className="a1-kicker">Kurulum akışı</span>
              <h2>Bilgiden müşteri sohbetine</h2>
            </div>
            <div className="a1-steps-grid">
              {steps.map(({ icon: Icon, title, description }, index) => (
                <article key={title} className="a1-step-card">
                  <div>
                    <Icon size={25} />
                    <span>{"0" + (index + 1)}</span>
                  </div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
      <footer className="a1-container a1-footer">
        <Brand />
        <p>Avenlyo · Kapalı test sürümü</p>
      </footer>
    </div>
  );
}

type AuthMode = "register" | "login" | "reset";

const authCopy = {
  register: {
    title: "Çalışma alanınızı oluşturun",
    description:
      "Kendi müşteri destek ajanınızı hazırlamak için bir test hesabı açın.",
    action: "Hesap oluştur",
  },
  login: {
    title: "Çalışma alanınıza giriş yapın",
    description: "Ajanınızı, bilgi bankanızı ve gelen talepleri yönetin.",
    action: "Giriş yap",
  },
  reset: {
    title: "Şifrenizi yenileyin",
    description:
      "Hesabınızın e-posta adresini ve kaydettiğiniz kurtarma kodunu kullanın.",
    action: "Şifreyi yenile",
  },
};

function AuthPage({ mode }: { mode: AuthMode }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [recovery, setRecovery] = useState("");
  const copy = authCopy[mode];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const result = await api<AccountCreated | { account: Session }>(
        "/a1/session/" + mode,
        {
          method: "POST",
          body: json({
            email: form.get("email"),
            password: form.get("password"),
            code: form.get("code"),
          }),
        },
      );
      if ("recoveryCode" in result) setRecovery(result.recoveryCode);
      else location.assign("/panel");
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="a1-auth">
      <header className="a1-container a1-auth-header">
        <Brand />
        <Badge>Kapalı test</Badge>
      </header>
      <main className="a1-auth-grid">
        <aside className="a1-auth-aside">
          <span className="a1-stage-icon">
            <Bot size={26} />
          </span>
          <h2>İşletmenizi tanıyan bir destek ajanı.</h2>
          <p>
            İşletmenizin bilgilerini ekleyin, yanıtları test edin ve müşteri
            sohbetini hazırlayın.
          </p>
          <a href="/sohbet/demo">
            Örnek sohbeti aç <ArrowUpRight size={16} />
          </a>
        </aside>
        <div className="panel a1-auth-card">
          {recovery ? (
            <>
              <h1>Kurtarma kodunuzu saklayın</h1>
              <p className="a1-muted">
                Şifrenizi unutursanız bu kodla hesabınıza yeniden
                erişebilirsiniz. Kodu güvenli bir yere kaydedin.
              </p>
              <output className="a1-code" aria-label="Kurtarma kodu">
                {recovery}
              </output>
              <div className="a1-actions">
                <CopyButton value={recovery} label="Kodu kopyala" />
                <a className="button primary" href="/panel">
                  Panele geç <ArrowRight size={16} />
                </a>
              </div>
            </>
          ) : (
            <>
              <h1>{copy.title}</h1>
              <p className="a1-muted">{copy.description}</p>
              <form onSubmit={(event) => void submit(event)}>
                <label>
                  E-posta{" "}
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    required
                    maxLength={254}
                  />
                </label>
                {mode === "reset" && (
                  <label>
                    Kurtarma kodu{" "}
                    <input
                      name="code"
                      autoComplete="off"
                      required
                      maxLength={43}
                    />
                  </label>
                )}
                <label>
                  {mode === "reset" ? "Yeni şifre" : "Şifre"}
                  <input
                    type="password"
                    name="password"
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    required
                    minLength={12}
                    maxLength={128}
                  />
                  {mode !== "login" && <small>En az 12 karakter.</small>}
                </label>
                <ErrorNotice message={error} />
                <button
                  type="submit"
                  className="button primary a1-wide"
                  disabled={busy}
                >
                  {busy ? "İşleniyor…" : copy.action} <ArrowRight size={17} />
                </button>
              </form>
              <div className="a1-auth-links">
                {mode === "login" ? (
                  <>
                    <a href="/kayit">Hesap oluştur</a>
                    <a href="/kurtar">Şifremi unuttum</a>
                  </>
                ) : (
                  <a href="/giris">Giriş ekranına dön</a>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default function Site() {
  const path = location.pathname.replace(/\/+$/, "") || "/";
  const chat = /^\/(sohbet|gomme)\/([a-z0-9-]+)$/.exec(path);
  let screen;
  if (path === "/") screen = <Landing />;
  else if (path === "/kayit") screen = <AuthPage mode="register" />;
  else if (path === "/giris") screen = <AuthPage mode="login" />;
  else if (path === "/kurtar") screen = <AuthPage mode="reset" />;
  else if (path === "/panel") screen = <Workspace />;
  else if (path === "/yerel") screen = <LocalWorkspace />;
  else if (chat)
    screen = <CustomerChat slug={chat[2]} embedded={chat[1] === "gomme"} />;
  else
    screen = (
      <main className="a1-centered">
        <Brand />
        <h1>Sayfa bulunamadı</h1>
        <a href="/">Ana sayfaya dön</a>
      </main>
    );
  return (
    <Suspense
      fallback={
        <div className="a1-centered">
          <Loading />
        </div>
      }
    >
      {screen}
    </Suspense>
  );
}
