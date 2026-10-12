"use client";
// Compartir un anuncio (WhatsApp, Facebook, X, email, copiar enlace o el menú del móvil) y contar
// la visita. Todo anónimo: se envía solo el identificador del anuncio y el de la pestaña.
import { useEffect, useRef, useState } from "react";
import { Check, Link2, Mail, Share2 } from "lucide-react";
import { getSessionId } from "@/lib/analytics-client";

type Channel = "whatsapp" | "facebook" | "x" | "email" | "copy" | "native";

function send(listingId: string, kind: "view" | "share", channel?: Channel) {
  try {
    void fetch("/api/inmuebles/estadisticas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId, kind, channel, sessionId: getSessionId() }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // nunca rompe la página
  }
}

/** Cuenta una visita al abrir la ficha (el servidor descarta robots y recargas). */
export function ListingViewTracker({ listingId }: { listingId: string }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    send(listingId, "view");
  }, [listingId]);
  return null;
}

export function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35M12.05 21.79h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.88 9.88m8.41-18.3A11.81 11.81 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.69 1.45h.01c6.55 0 11.89-5.34 11.89-11.89 0-3.18-1.24-6.16-3.48-8.41" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M24 12.07C24 5.41 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.5c-1.5 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.62 23.1 24 18.1 24 12.07" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.21-6.82-5.97 6.82H1.67l7.73-8.84L1.25 2.25h6.83l4.71 6.23 5.45-6.23Zm-1.16 17.52h1.83L7.08 4.13H5.12l11.96 15.64Z" />
    </svg>
  );
}

export interface ShareTexts {
  title: string;
  whatsapp: string;
  facebook: string;
  x: string;
  email: string;
  copy: string;
  copied: string;
  more: string;
}

/** Botones para compartir la ficha. `message` ya incluye título y precio; se añade el enlace. */
export function ShareButtons({ listingId, url, message, t }: { listingId: string; url: string; message: string; t: ShareTexts }) {
  const [copied, setCopied] = useState(false);
  const [canNative, setCanNative] = useState(false);
  useEffect(() => setCanNative(typeof navigator !== "undefined" && typeof navigator.share === "function"), []);
  const text = `${message}\n${url}`;
  const btn =
    "inline-flex h-10 items-center gap-2 rounded-full border border-sand-300 bg-white px-3.5 text-sm font-medium text-ink-700 transition hover:border-ink-400 hover:bg-sand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta-500";

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label={t.title} role="group">
      <span className="mr-1 text-sm font-medium text-ink-500">{t.title}:</span>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(text)}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => send(listingId, "share", "whatsapp")}
        className="inline-flex h-10 items-center gap-2 rounded-full bg-[#25D366] px-4 text-sm font-semibold text-white transition hover:bg-[#1ebe5b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta-500"
      >
        <WhatsAppIcon className="h-4 w-4" /> {t.whatsapp}
      </a>
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => send(listingId, "share", "facebook")}
        className={btn}
        aria-label={t.facebook}
      >
        <FacebookIcon className="h-4 w-4" /> <span className="hidden sm:inline">{t.facebook}</span>
      </a>
      <a
        href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => send(listingId, "share", "x")}
        className={btn}
        aria-label={t.x}
      >
        <XIcon className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{t.x}</span>
      </a>
      <a
        href={`mailto:?subject=${encodeURIComponent(message)}&body=${encodeURIComponent(text)}`}
        onClick={() => send(listingId, "share", "email")}
        className={btn}
        aria-label={t.email}
      >
        <Mail className="h-4 w-4" /> <span className="hidden sm:inline">{t.email}</span>
      </a>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
            send(listingId, "share", "copy");
          } catch {
            // el navegador no deja copiar: no hacemos nada
          }
        }}
        className={btn}
        aria-live="polite"
      >
        {copied ? <Check className="h-4 w-4 text-pine-600" /> : <Link2 className="h-4 w-4" />} {copied ? t.copied : t.copy}
      </button>
      {canNative && (
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.share({ title: message, text: message, url });
              send(listingId, "share", "native");
            } catch {
              // cancelado por el usuario
            }
          }}
          className={btn}
        >
          <Share2 className="h-4 w-4" /> {t.more}
        </button>
      )}
    </div>
  );
}

/** Icono de WhatsApp sobre la foto de las tarjetas de resultados. */
export function CardWhatsApp({ listingId, url, message, label }: { listingId?: string; url: string; message: string; label: string }) {
  return (
    <a
      href={`https://wa.me/?text=${encodeURIComponent(`${message}
${url}`)}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      onClick={() => listingId && send(listingId, "share", "whatsapp")}
      className="pointer-events-auto absolute bottom-3 right-3 grid h-10 w-10 place-items-center rounded-full bg-[#25D366] text-white shadow-md transition hover:scale-105 hover:bg-[#1ebe5b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
    >
      <WhatsAppIcon className="h-5 w-5" />
    </a>
  );
}
