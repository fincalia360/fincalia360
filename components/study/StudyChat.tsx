"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Loader2, MessageCircle, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string; actions?: string[] };

const ACTION_LABELS: Record<string, string> = {
  SELL: "Pedir ayuda para vender",
  RENT: "Pedir ayuda para alquilar",
  ADVICE: "Hablar con un profesional",
};

const SUGGESTIONS = ["¿Me conviene vender o alquilar?", "¿Cuánto dinero me quedaría si vendo hoy?", "¿Qué alquiler puedo pedir legalmente?"];

const GREETING =
  "¡Hola! Soy el asistente virtual de FINCALIA360. Conozco los resultados de tu estudio y puedo ayudarte a entenderlos y a decidir el siguiente paso. Puedes escribirme en tu idioma.\n\nHi! You can write to me in any language · Vous pouvez m'écrire dans votre langue · Sie können mir in Ihrer Sprache schreiben.";

/** Abre el formulario de la pantalla final con la opción indicada (lo escucha NextStepPanel). */
export function openNextStep(interest: string) {
  window.dispatchEvent(new CustomEvent("fincalia:next-step", { detail: interest }));
}

export function StudyChat({ studyId }: { studyId: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function send(content: string) {
    const clean = content.trim();
    if (!clean || sending) return;
    setError(null);
    const next = [...messages, { role: "user" as const, content: clean }];
    setMessages(next);
    setText("");
    setSending(true);
    try {
      const res = await fetch(`/api/estudio/${studyId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.map(({ role, content: c }) => ({ role, content: c })) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "El asistente no ha podido responder.");
      setMessages((m) => [...m, { role: "assistant", content: data.text, actions: data.actions }]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full bg-ink-800 px-5 py-3 text-sm font-semibold text-white shadow-lg hover:bg-ink-700 sm:bottom-6 sm:right-6"
        >
          <MessageCircle className="h-5 w-5" /> ¿Dudas? Pregunta al asistente
        </button>
      )}
      {open && (
        <div
          role="dialog"
          aria-label="Asistente virtual de FINCALIA360"
          className="fixed inset-x-0 bottom-0 z-40 flex max-h-[85vh] flex-col rounded-t-2xl border border-sand-200 bg-white shadow-2xl sm:inset-x-auto sm:bottom-6 sm:right-6 sm:h-[600px] sm:w-[400px] sm:rounded-2xl"
        >
          <div className="flex items-center justify-between rounded-t-2xl bg-ink-800 px-4 py-3 text-white">
            <div>
              <p className="text-sm font-semibold">Asistente FINCALIA360</p>
              <p className="text-[11px] text-ink-200">Asistente automático con IA · en tu idioma</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar el asistente" className="rounded-full p-1 hover:bg-white/10">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-sand-50 px-4 py-4" aria-live="polite">
            <Bubble role="assistant" content={GREETING} />
            {messages.length === 0 && (
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-sand-300 bg-white px-3 py-1.5 text-left text-[13px] text-ink-700 hover:border-terracotta-400">
                    {s}
                  </button>
                ))}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i}>
                <Bubble role={m.role} content={m.content} />
                {m.actions && m.actions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {m.actions.map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => {
                          openNextStep(a);
                          setOpen(false);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-full bg-terracotta-500 px-3.5 py-1.5 text-[13px] font-semibold text-white hover:bg-terracotta-600"
                      >
                        {ACTION_LABELS[a] ?? a} <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {sending && (
              <p className="flex items-center gap-2 text-sm text-ink-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Escribiendo…
              </p>
            )}
            {error && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {error}
              </p>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(text);
            }}
            className="border-t border-sand-200 p-3"
          >
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                rows={1}
                maxLength={1000}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send(text);
                  }
                }}
                placeholder="Escribe tu pregunta…"
                aria-label="Tu mensaje"
                className="field max-h-32 min-h-[42px] flex-1 resize-none py-2.5 text-sm"
              />
              <button type="submit" disabled={sending || !text.trim()} aria-label="Enviar" className="grid h-[42px] w-[42px] place-items-center rounded-xl bg-terracotta-500 text-white disabled:opacity-40">
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-[11px] leading-snug text-ink-400">
              Asistente automático: puede equivocarse, las cifras de referencia son las de tu estudio. No compartas datos personales aquí. No guardamos esta conversación.
            </p>
          </form>
        </div>
      )}
    </>
  );
}

function Bubble({ role, content }: { role: "user" | "assistant"; content: string }) {
  return (
    <div className={cn("flex", role === "user" ? "justify-end" : "justify-start")}>
      <p
        className={cn(
          "max-w-[88%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed",
          role === "user" ? "rounded-br-sm bg-ink-800 text-white" : "rounded-bl-sm border border-sand-200 bg-white text-ink-800",
        )}
      >
        {content}
      </p>
    </div>
  );
}
