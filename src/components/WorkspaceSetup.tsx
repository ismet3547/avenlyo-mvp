import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  Code2,
  FileText,
  Link2,
  Pause,
  Plus,
  Send,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import type {
  PreviewAnswer,
  WorkspaceProfile,
  WorkspaceSource,
  WorkspaceState,
} from "../../shared";
import { api, json } from "../api";
import { Empty, Modal } from "./ui";
import { Badge, CopyButton, ErrorNotice } from "./site-ui";

type Save = (state: WorkspaceState) => void;
const base = "/a1/workspace";

const blankProfile: WorkspaceProfile = {
  businessName: "",
  agentName: "Müşteri Destek",
  description: "",
  tone: "Samimi ve profesyonel",
  contactEmail: "",
};

export function ProfileStep({
  profile,
  saved,
}: {
  profile: WorkspaceProfile | null;
  saved: Save;
}) {
  const [form, setForm] = useState(profile ?? blankProfile);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function update(key: keyof WorkspaceProfile, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      saved(
        await api<WorkspaceState>(base + "/profile", {
          method: "PUT",
          body: json(form),
        }),
      );
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel a1-form" onSubmit={(event) => void submit(event)}>
      <div className="form-grid">
        <label>
          İşletme adı
          <input
            value={form.businessName}
            onChange={(e) => update("businessName", e.target.value)}
            placeholder="Örn. Deniz Mobilya"
            maxLength={100}
            required
          />
        </label>
        <label>
          Ajan adı
          <input
            value={form.agentName}
            onChange={(e) => update("agentName", e.target.value)}
            maxLength={60}
            required
          />
        </label>
      </div>
      <label>
        İşletme açıklaması
        <textarea
          value={form.description}
          onChange={(e) => update("description", e.target.value)}
          placeholder="Hangi ürün veya hizmetleri sunuyorsunuz?"
          rows={3}
          maxLength={3000}
        />
      </label>
      <div className="form-grid">
        <label>
          Yanıt tonu
          <select
            value={form.tone}
            onChange={(e) => update("tone", e.target.value)}
          >
            <option>Samimi ve profesyonel</option>
            <option>Resmî ve net</option>
            <option>Kısa ve doğrudan</option>
          </select>
        </label>
        <label>
          İletişim e-postası
          <input
            value={form.contactEmail}
            onChange={(e) => update("contactEmail", e.target.value)}
            type="email"
            placeholder="destek@isletmeniz.com"
            maxLength={254}
          />
          <small>
            İsteğe bağlı. Sohbet duraklatıldığında müşteriye gösterilir.
          </small>
        </label>
      </div>
      <ErrorNotice message={error} />
      <div className="form-actions">
        <button type="submit" className="button primary" disabled={busy}>
          {busy ? "Kaydediliyor…" : "Kaydet ve devam et"}{" "}
          <ArrowRight size={17} />
        </button>
      </div>
    </form>
  );
}

function KnowledgeEditor({
  source,
  saved,
  cancel,
}: {
  source?: WorkspaceSource;
  saved: Save;
  cancel: () => void;
}) {
  const [kind, setKind] = useState(source && !source.question ? "text" : "faq");
  const [title, setTitle] = useState(
    source?.question ? "" : (source?.title ?? ""),
  );
  const [question, setQuestion] = useState(source?.question ?? "");
  const [content, setContent] = useState(source?.content ?? "");
  const [approved, setApproved] = useState(source?.approved ?? true);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");

  async function read(file: File | undefined) {
    if (!file) return;
    setError("");
    if (!/\.(txt|md)$/i.test(file.name) || file.size > 100_000) {
      setError("100 KB veya daha küçük bir TXT ya da Markdown dosyası seçin.");
      return;
    }
    setReading(true);
    try {
      const value = await file.text();
      if (value.length > 30_000)
        throw new Error("Dosya içeriği en fazla 30.000 karakter olabilir.");
      setTitle(
        (current) =>
          current || file.name.replace(/\.(txt|md)$/i, "").slice(0, 100),
      );
      setContent(value);
    } catch (error) {
      setError((error as Error).message || "Dosya okunamadı.");
    } finally {
      setReading(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || reading) return;
    setBusy(true);
    setError("");
    try {
      const data = await api<WorkspaceState>(
        base + "/sources" + (source ? "/" + source.id : ""),
        {
          method: source ? "PUT" : "POST",
          body: json({
            title: kind === "faq" ? question.trim().slice(0, 100) : title,
            question: kind === "faq" ? question : "",
            content,
            approved,
          }),
        },
      );
      saved(data);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel a1-form" onSubmit={(event) => void submit(event)}>
      <h3>{source ? "Kaynağı düzenle" : "Bilgi ekle"}</h3>
      {!source && (
        <fieldset className="a1-kind">
          <legend>Kaynak türü</legend>
          <label>
            <input
              type="radio"
              name="kind"
              checked={kind === "faq"}
              onChange={() => setKind("faq")}
              disabled={reading || busy}
            />{" "}
            Soru-cevap
          </label>
          <label>
            <input
              type="radio"
              name="kind"
              checked={kind === "text"}
              onChange={() => setKind("text")}
              disabled={reading || busy}
            />{" "}
            Metin veya dosya
          </label>
        </fieldset>
      )}
      {kind === "faq" ? (
        <label>
          Soru
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Örn. Teslimat kaç gün sürer?"
            maxLength={300}
            required
          />
        </label>
      ) : (
        <>
          <label>
            Kaynak başlığı
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Örn. Teslimat koşulları"
              maxLength={100}
              required
            />
          </label>
          <label className="a1-file">
            <span>
              <Upload size={18} /> TXT veya Markdown yükle
            </span>
            <input
              type="file"
              accept=".txt,.md"
              disabled={reading || busy}
              onChange={(e) => {
                void read(e.target.files?.[0]);
                e.currentTarget.value = "";
              }}
            />
            <small>En fazla 100 KB ve 30.000 karakter.</small>
          </label>
        </>
      )}
      <label>
        {kind === "faq" ? "Yanıt" : "Kaynak metni"}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={
            kind === "faq"
              ? "Müşteriye gösterilecek yanıtı yazın."
              : "İşletmenizin paylaşabileceği bilgiyi yazın."
          }
          rows={5}
          maxLength={30000}
          required
        />
      </label>
      <label className="a1-check">
        <input
          type="checkbox"
          checked={approved}
          onChange={(e) => setApproved(e.target.checked)}
        />
        Ajan bu bilgiyi kullanabilir
      </label>
      <small className="a1-muted">
        Onaylı bilgiler yayınlandığında müşteri yanıtlarında görünebilir.
      </small>
      <ErrorNotice message={error} />
      <div className="form-actions">
        <button type="button" className="button secondary" onClick={cancel}>
          Vazgeç
        </button>
        <button
          type="submit"
          className="button primary"
          disabled={reading || busy}
        >
          {reading
            ? "Dosya okunuyor…"
            : busy
              ? "Kaydediliyor…"
              : "Bilgiyi kaydet"}{" "}
          <Check size={17} />
        </button>
      </div>
    </form>
  );
}

export function KnowledgeStep({
  state,
  saved,
  next,
}: {
  state: WorkspaceState;
  saved: Save;
  next: () => void;
}) {
  const [editor, setEditor] = useState<WorkspaceSource | "new" | null>(
    state.sources.length ? null : "new",
  );
  const [remove, setRemove] = useState<WorkspaceSource | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const approved = state.sources.filter((source) => source.approved).length;

  async function deleteSource() {
    if (!remove || deleting) return;
    setDeleting(true);
    setError("");
    try {
      saved(
        await api<WorkspaceState>(base + "/sources/" + remove.id, {
          method: "DELETE",
        }),
      );
      if (typeof editor === "object" && editor?.id === remove.id)
        setEditor(null);
      setRemove(null);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="a1-stack">
      <div className="a1-section-bar">
        <Badge tone={approved ? "success" : "neutral"}>
          {approved} onaylı kaynak
        </Badge>
        <button
          type="button"
          className="button secondary"
          onClick={() => setEditor("new")}
        >
          <Plus size={17} /> Bilgi ekle
        </button>
      </div>
      {state.sources.length > 0 && (
        <div className="a1-list">
          {state.sources.map((source) => (
            <article className="a1-source-row" key={source.id}>
              <span className="a1-list-icon">
                <FileText size={20} />
              </span>
              <button
                type="button"
                className="a1-source-title"
                onClick={() => setEditor(source)}
              >
                <strong>{source.question || source.title}</strong>
                <span>{source.category}</span>
              </button>
              <Badge tone={source.approved ? "success" : "neutral"}>
                {source.approved ? "Onaylı" : "Taslak"}
              </Badge>
              <button
                type="button"
                className="icon-button"
                aria-label={source.title + " kaynağını kaldır"}
                onClick={() => {
                  setError("");
                  setRemove(source);
                }}
              >
                <Trash2 size={18} />
              </button>
            </article>
          ))}
        </div>
      )}
      {editor && (
        <KnowledgeEditor
          key={editor === "new" ? "new" : editor.id}
          source={editor === "new" ? undefined : editor}
          saved={(nextState) => {
            saved(nextState);
            setEditor(null);
          }}
          cancel={() => setEditor(null)}
        />
      )}
      {!editor && !state.sources.length && (
        <Empty
          icon={<BookOpen />}
          title="İlk bilginizi ekleyin"
          description="En sık duyduğunuz müşteri sorusuyla başlayın."
        />
      )}
      <div className="form-actions">
        <button
          type="button"
          className="button primary"
          onClick={next}
          disabled={!approved}
        >
          Teste geç <ArrowRight size={17} />
        </button>
      </div>
      {remove && (
        <Modal
          title="Kaynak taslaktan kaldırılsın mı?"
          onClose={() => {
            if (!deleting) setRemove(null);
          }}
        >
          <div className="form-body">
            <p>
              <strong>{remove.title}</strong> taslaktan kaldırılır. Yayındaki
              içerik, yeniden yayınladığınızda güncellenir.
            </p>
            <ErrorNotice message={error} />
          </div>
          <div className="modal-foot">
            <button
              type="button"
              className="button secondary"
              disabled={deleting}
              onClick={() => setRemove(null)}
            >
              Vazgeç
            </button>
            <button
              type="button"
              className="button destructive"
              disabled={deleting}
              onClick={() => void deleteSource()}
            >
              {deleting ? "Kaldırılıyor…" : "Kaynağı kaldır"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export function PreviewStep({
  state,
  saved,
  next,
}: {
  state: WorkspaceState;
  saved: Save;
  next: () => void;
}) {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<PreviewAnswer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const suggestions = state.sources
    .filter((source) => source.approved && source.question)
    .slice(0, 3);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!question.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const data = await api<{ result: PreviewAnswer; state: WorkspaceState }>(
        base + "/preview",
        {
          method: "POST",
          body: json({ question }),
        },
      );
      setResult(data.result);
      saved(data.state);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="a1-stack">
      <form className="panel a1-form" onSubmit={(event) => void submit(event)}>
        {!state.modelConfigured &&
          state.sources.some(
            (source) => source.approved && !source.question,
          ) && (
            <p className="a1-test-hint">
              Metin kaynaklarını denemek için test sunucusunun model bağlantısı
              gerekir. Kaydedilmiş soru-cevapları aynı soruyla hemen
              deneyebilirsiniz.
            </p>
          )}
        <label>
          Müşteriniz ne sorabilir?
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ajanınıza bir soru yazın…"
            rows={3}
            maxLength={8000}
            required
            disabled={busy}
          />
        </label>
        {!!suggestions.length && (
          <div className="a1-suggestions" aria-label="Örnek sorular">
            {suggestions.map((source) => (
              <button
                key={source.id}
                type="button"
                onClick={() => setQuestion(source.question)}
                disabled={busy}
              >
                {source.question}
              </button>
            ))}
          </div>
        )}
        <ErrorNotice message={error} />
        <div className="form-actions">
          <button
            type="submit"
            className="button primary"
            disabled={busy || !question.trim()}
          >
            {busy ? "Yanıt hazırlanıyor…" : "Soruyu dene"} <Send size={17} />
          </button>
        </div>
      </form>
      {result && (
        <section className="panel a1-preview-answer" aria-live="polite">
          <h3>
            <Sparkles size={19} /> Ajanın yanıtı
          </h3>
          <p>{result.text}</p>
          {result.source ? (
            <Badge tone="success">
              <BookOpen size={15} /> Kaynak · {result.source.title}
            </Badge>
          ) : (
            <Badge tone="warning">Ekibe devir önerildi</Badge>
          )}
        </section>
      )}
      <div className="a1-section-bar">
        <span className="a1-muted">
          {state.tested
            ? "Bu taslak kaynaklı yanıt testini geçti."
            : "Yayına geçmek için onaylı bir kaynağa dayanan yanıt alın."}
        </span>
        <button
          type="button"
          className="button primary"
          disabled={!state.tested || busy}
          onClick={next}
        >
          Yayına geç <ArrowRight size={17} />
        </button>
      </div>
    </div>
  );
}

export function PublishStep({
  state,
  saved,
}: {
  state: WorkspaceState;
  saved: Save;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const publication = state.publication;
  const live = publication?.status === "live";
  const link = publication
    ? location.origin + "/sohbet/" + publication.slug
    : "";
  const embed = publication
    ? '<iframe src="' +
      location.origin +
      "/gomme/" +
      publication.slug +
      '" title="Avenlyo müşteri desteği" width="400" height="600" style="border:0;max-width:100%"></iframe>'
    : "";

  async function change(pause: boolean) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      saved(
        await api<WorkspaceState>(
          base + "/publication" + (pause ? "/pause" : ""),
          {
            method: pause ? "POST" : "PUT",
          },
        ),
      );
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="a1-stack">
      <section className="panel a1-stack">
        <div className="a1-section-bar">
          <h3>Yayın durumu</h3>
          <Badge tone={live ? "success" : publication ? "warning" : "neutral"}>
            {live ? "Yayında" : publication ? "Duraklatıldı" : "Taslak"}
          </Badge>
        </div>
        <p className="a1-muted">
          Bağlantı bu bilgisayardaki kapalı test sunucusunda çalışır.
          Düzenlemeler yeniden yayınladığınızda sohbet sayfasına yansır.
        </p>
        {!state.tested && (
          <p className="a1-error">
            Bu taslağı yayınlamak için önce test ekranında kaynaklı bir yanıt
            alın.
          </p>
        )}
        {state.unpublishedChanges && (
          <Badge tone="warning">Yayınlanmamış değişiklikler var</Badge>
        )}
        <ErrorNotice message={error} />
        <div className="a1-actions">
          <button
            type="button"
            className="button primary"
            disabled={
              busy || !state.tested || (live && !state.unpublishedChanges)
            }
            onClick={() => void change(false)}
          >
            <Send size={17} />{" "}
            {live
              ? "Güncellemeyi yayınla"
              : publication
                ? "Yayını başlat"
                : "Ajanı yayınla"}
          </button>
          {live && (
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={() => void change(true)}
            >
              <Pause size={17} /> Yayını duraklat
            </button>
          )}
        </div>
      </section>
      {publication && (
        <div className="a1-share-grid">
          <section className="panel a1-stack">
            <h3>
              <Link2 size={19} /> Sohbet bağlantısı
            </h3>
            <input
              aria-label="Sohbet bağlantısı"
              value={link}
              readOnly
              onFocus={(e) => e.currentTarget.select()}
            />
            <div className="a1-actions">
              <CopyButton value={link} label="Bağlantıyı kopyala" />
              <a
                className="button secondary"
                href={link}
                target="_blank"
                rel="noreferrer"
              >
                Sohbeti aç <ArrowUpRight size={16} />
              </a>
            </div>
          </section>
          <section className="panel a1-stack">
            <h3>
              <Code2 size={19} /> Siteye ekle
            </h3>
            <p className="a1-muted">
              Kodu yerel test sitenizin HTML alanına ekleyin.
            </p>
            <textarea
              aria-label="Sohbet kutusu ekleme kodu"
              value={embed}
              readOnly
              rows={3}
              onFocus={(e) => e.currentTarget.select()}
            />
            <CopyButton value={embed} label="Kodu kopyala" />
          </section>
        </div>
      )}
    </div>
  );
}
