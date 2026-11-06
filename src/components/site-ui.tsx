import { Check, Clipboard, LoaderCircle } from "lucide-react";
import { useState, type ReactNode } from "react";

export function Brand({ href = "/" }: { href?: string }) {
  return (
    <a href={href} className="a1-brand" aria-label="Avenlyo">
      <span className="brand-mark" aria-hidden="true">
        a
      </span>
      <span>
        avenlyo<span className="a1-brand-dot">.</span>
      </span>
    </a>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning";
}) {
  return (
    <span className={"a1-badge " + tone}>
      <i aria-hidden="true" />
      {children}
    </span>
  );
}

export function ErrorNotice({ message }: { message: string }) {
  return message ? (
    <p className="a1-error" role="alert">
      {message}
    </p>
  ) : null;
}

export function Loading({
  children = "Yükleniyor…",
}: {
  children?: ReactNode;
}) {
  return (
    <p className="a1-loading" role="status">
      <LoaderCircle className="spin" size={20} />
      {children}
    </p>
  );
}

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }
  return (
    <div className="a1-copy">
      <button
        className="button secondary"
        type="button"
        onClick={() => void copy()}
      >
        {status === "copied" ? <Check size={17} /> : <Clipboard size={17} />}
        {status === "copied" ? "Kopyalandı" : label}
      </button>
      <span
        className={status === "error" ? "a1-muted" : "sr-only"}
        role="status"
      >
        {status === "error"
          ? "Metni seçip elle kopyalayabilirsiniz."
          : status === "copied"
            ? "Kopyalandı."
            : ""}
      </span>
    </div>
  );
}
