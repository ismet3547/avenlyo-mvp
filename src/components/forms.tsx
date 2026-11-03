import { useState, type FormEvent } from "react";
import { Check, FileText, LoaderCircle, Upload } from "lucide-react";
import type { Agent, Source } from "../../shared";
import { api, json } from "../api";
import {
  AgentIcon,
  Modal,
  agentIcons,
  agentIconLabels,
  agentColors,
} from "./ui";

type FormProps = {
  onClose: () => void;
  onSaved: () => Promise<void>;
  notify: (message: string) => void;
};
export function AgentForm({
  agent,
  sources,
  onClose,
  onSaved,
  notify,
}: FormProps & { agent?: Agent; sources: Source[] }) {
  const [form, setForm] = useState({
    name: agent?.name || "",
    description: agent?.description || "",
    instructions: agent?.instructions || "",
    icon: agent?.icon || "bot",
    color: agent?.color || "purple",
    model: agent?.model || "",
    sourceIds: agent?.sourceIds || [],
    active: agent?.active ?? true,
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(agent ? `/agents/${agent.id}` : "/agents", {
        method: agent ? "PUT" : "POST",
        body: json(form),
      });
      await onSaved();
      notify(agent ? "Ajan güncellendi." : "Yeni ajanınız hazır.");
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={agent ? "Ajanı düzenle" : "Yeni bir ajan oluştur"}
      subtitle="Bir görev verin, çalışma şeklini siz belirleyin."
      onClose={onClose}
      wide
    >
      <form onSubmit={save}>
        <div className="form-body">
          <div className="agent-identity">
            <AgentIcon icon={form.icon} color={form.color} />
            <div className="icon-options">
              {Object.keys(agentIcons).map((icon) => (
                <button
                  type="button"
                  key={icon}
                  className={`icon-choice ${form.icon === icon ? "selected" : ""}`}
                  aria-label={`${agentIconLabels[icon as keyof typeof agentIcons]} simgesi`}
                  aria-pressed={form.icon === icon}
                  onClick={() => setForm({ ...form, icon })}
                >
                  <AgentIcon icon={icon} color={form.color} small />
                </button>
              ))}
            </div>
          </div>
          <div className="color-options" aria-label="Ajan rengi">
            {Object.entries(agentColors).map(([color, label]) => (
              <button
                type="button"
                key={color}
                className={`color-dot ${color}`}
                aria-label={`${label} renk`}
                title={label}
                aria-pressed={form.color === color}
                onClick={() => setForm({ ...form, color })}
              >
                {form.color === color && <Check size={13} />}
              </button>
            ))}
          </div>
          <label>
            Ajan adı <span>*</span>
            <input
              required
              maxLength={60}
              placeholder="Örn. Müşteri Destek"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label>
            Kısa açıklama
            <input
              maxLength={180}
              placeholder="Bu ajan ne konuda yardımcı olacak?"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </label>
          <label>
            Talimatlar <span>*</span>
            <textarea
              required
              rows={5}
              maxLength={12000}
              placeholder="Ajanınızın rolünü, görevlerini ve nasıl yanıt vermesini istediğinizi yazın…"
              value={form.instructions}
              onChange={(e) =>
                setForm({ ...form, instructions: e.target.value })
              }
            />
            <small>
              İşletme profiliniz her sohbete otomatik olarak eklenir.
            </small>
          </label>
          <label>
            Model
            <input
              maxLength={100}
              placeholder="Varsayılan modeli kullan"
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
            />
          </label>
          <fieldset>
            <legend>Bilgi kaynakları</legend>
            {sources.length ? (
              sources.map((source) => (
                <label key={source.id} className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={form.sourceIds.includes(source.id)}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        sourceIds: e.target.checked
                          ? [...form.sourceIds, source.id]
                          : form.sourceIds.filter((id) => id !== source.id),
                      })
                    }
                  />
                  <FileText size={17} />
                  <span>{source.title}</span>
                </label>
              ))
            ) : (
              <p className="muted small-text">
                Henüz kaynak yok. Bilgi bankasından ekleyip bu ajana
                atayabilirsiniz.
              </p>
            )}
          </fieldset>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            <span>Ajan aktif</span>
          </label>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
        </div>
        <div className="modal-foot">
          <button type="button" className="button secondary" onClick={onClose}>
            Vazgeç
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <Check size={16} />
            )}{" "}
            {busy
              ? "Kaydediliyor…"
              : agent
                ? "Değişiklikleri kaydet"
                : "Ajanı oluştur"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function SourceForm({
  source,
  onClose,
  onSaved,
  notify,
}: FormProps & { source?: Source }) {
  const [form, setForm] = useState({
    title: source?.title || "",
    content: source?.content || "",
    category: source?.category || "Genel",
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function importFile(file?: File) {
    if (!file) return;
    if (!/\.(txt|md)$/i.test(file.name)) {
      setError("Lütfen .txt veya .md dosyası seçin.");
      return;
    }
    if (file.size > 100_000) {
      setError("Dosya en fazla 100 KB olabilir.");
      return;
    }
    try {
      const content = await file.text();
      setForm({
        ...form,
        title: form.title || file.name.replace(/\.(txt|md)$/i, ""),
        content,
      });
      setError("");
    } catch {
      setError("Dosya okunamadı.");
    }
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(source ? `/sources/${source.id}` : "/sources", {
        method: source ? "PUT" : "POST",
        body: json(form),
      });
      await onSaved();
      notify(
        source ? "Kaynak güncellendi." : "Kaynak bilgi bankasına eklendi.",
      );
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={source ? "Kaynağı düzenle" : "Bilgi kaynağı ekle"}
      subtitle="Ajanlarınıza işletmenizi anlatan güvenilir bilgiler verin."
      onClose={onClose}
      wide
    >
      <form onSubmit={save}>
        <div className="form-body">
          <label className="file-drop">
            <Upload size={23} />
            <strong>Metin dosyası yükleyin</strong>
            <span>
              veya bilgilerinizi aşağıya yazın · TXT, MD · En fazla 100 KB
            </span>
            <input
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              onChange={(e) => {
                void importFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          <div className="form-grid">
            <label>
              Kaynak adı <span>*</span>
              <input
                required
                maxLength={100}
                placeholder="Örn. Ürün kataloğu"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </label>
            <label>
              Kategori
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {[
                  "Genel",
                  "Ürün ve hizmetler",
                  "Müşteri desteği",
                  "Marka ve iletişim",
                  "Politikalar",
                ].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            İçerik <span>*</span>
            <textarea
              required
              rows={10}
              maxLength={30000}
              placeholder="Ürünleriniz, sık sorulan sorular, hizmet koşulları veya markanız hakkında bilgiler…"
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
            />
            <small>
              {form.content.length.toLocaleString("tr-TR")} / 30.000 karakter ·
              Kaydettikten sonra ajanlarınıza atayın.
            </small>
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="modal-foot">
          <button type="button" className="button secondary" onClick={onClose}>
            Vazgeç
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <Check size={16} />
            )}
            Kaynağı kaydet
          </button>
        </div>
      </form>
    </Modal>
  );
}
