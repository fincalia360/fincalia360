"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCheck, RotateCcw, SendHorizontal } from "lucide-react";
import { SlotPicker } from "@/components/booking/SlotPicker";
import { LOCALES, type Dictionary } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { ConversationView } from "@/services/agentService";
import type { QuickReply } from "@/services/ai/types";
import type { Slot } from "@/types";
import { AgentInsights } from "./AgentInsights";

interface PendingMessage {
  id: string;
  role: "lead";
  content: string;
  createdAt: string;
}

export function AgentChat({ initialView, dict }: { initialView: ConversationView; dict: Dictionary }) {
  const [view, setView] = useState(initialView);
  const [pending, setPending] = useState<PendingMessage | null>(null);
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const locale = LOCALES[view.language];
  const ui = dict.agent.ui;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [view, pending, typing]);

  async function post(body: Record<string, unknown>, optimistic?: string) {
    if (optimistic) setPending({ id: "pending", role: "lead", content: optimistic, createdAt: new Date().toISOString() });
    setTyping(true);
    const started = Date.now();
    try {
      const res = await fetch(`/api/agent/${view.leadId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const next = (await res.json()) as ConversationView;
      // Pequeña pausa para que el "escribiendo…" resulte natural.
      const wait = Math.max(0, 650 - (Date.now() - started));
      await new Promise((r) => setTimeout(r, wait));
      if (res.ok) setView(next);
    } finally {
      setTyping(false);
      setPending(null);
    }
  }

  const send = (message: string, value?: string) => {
    if (!message.trim() || typing) return;
    setText("");
    void post({ action: "message", text: message.trim(), value }, message.trim());
  };

  const quick = (q: QuickReply) => send(q.label, q.value);
  const book = (slot: Slot) => {
    const d = new Date(slot.iso);
    void post(
      { action: "book", slot: slot.iso },
      `${d.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })} · ${slot.label}`,
    );
  };
  const reset = () => void post({ action: "reset" });

  const messages = [...view.messages, ...(pending ? [pending] : [])];
  const time = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,440px)_1fr] lg:items-start">
      {/* Teléfono */}
      <div className="mx-auto flex h-[calc(100dvh-120px)] max-h-[760px] min-h-[520px] w-full max-w-[440px] flex-col overflow-hidden rounded-[28px] border border-ink-900/10 bg-[#EFE7DC] shadow-soft">
        <header className="flex items-center gap-3 bg-[#1F3A33] px-4 py-3 text-white">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sand-100 font-serif text-lg font-semibold text-ink-800">M</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold">Marina · Tramontana</p>
            <p className="text-xs text-white/70">{typing ? ui.typing : ui.online}</p>
          </div>
          <button type="button" onClick={reset} title="Reiniciar conversación (demo)" className="rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white">
            <RotateCcw className="h-4 w-4" />
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-4" style={{ backgroundImage: "radial-gradient(rgba(19,41,61,0.05) 1px, transparent 1px)", backgroundSize: "18px 18px" }}>
          <p className="mx-auto mb-3 w-fit rounded-md bg-[#FFF5D6] px-3 py-1 text-center text-[11px] text-ink-500 shadow-sm">
            Simulación de WhatsApp · ningún mensaje sale de este equipo
          </p>
          {messages.map((m) => {
            const mine = m.role === "lead";
            return (
              <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[82%] rounded-2xl px-3 py-2 text-[14.5px] leading-snug shadow-sm",
                    mine ? "rounded-tr-sm bg-[#D9F2CF] text-ink-900" : "rounded-tl-sm bg-white text-ink-900",
                  )}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>
                  <p className="mt-0.5 flex items-center justify-end gap-1 text-[10.5px] text-ink-400">
                    {time(m.createdAt)}
                    {mine && <CheckCheck className="h-3 w-3 text-sky-500" />}
                  </p>
                </div>
              </div>
            );
          })}
          {typing && (
            <div className="flex justify-start">
              <div className="flex gap-1 rounded-2xl rounded-tl-sm bg-white px-4 py-3 shadow-sm">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-300" style={{ animationDelay: `${i * 120}ms` }} />
                ))}
              </div>
            </div>
          )}
          {!typing && view.showSlots && (
            <div className="rounded-2xl bg-white p-3 shadow-sm">
              <SlotPicker slots={view.slots} labels={{ today: dict.result.today, tomorrow: dict.result.tomorrow }} locale={locale} onSelect={book} compact />
            </div>
          )}
        </div>

        {!typing && view.quickReplies.length > 0 && (
          <div className="flex gap-2 overflow-x-auto border-t border-black/5 bg-[#F4EEE5] px-3 py-2.5 scrollbar-none">
            {view.quickReplies.map((q) => (
              <button
                key={q.value}
                type="button"
                onClick={() => quick(q)}
                className="shrink-0 rounded-full border border-[#1F3A33]/20 bg-white px-3.5 py-1.5 text-[13px] font-medium text-[#1F3A33] hover:bg-[#1F3A33] hover:text-white"
              >
                {q.label}
              </button>
            ))}
          </div>
        )}

        <form
          className="flex items-center gap-2 bg-[#F4EEE5] px-3 py-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            send(text);
          }}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={ui.placeholder}
            aria-label={ui.placeholder}
            className="h-11 min-w-0 flex-1 rounded-full border-0 bg-white px-4 text-[15px] shadow-sm outline-none focus:ring-2 focus:ring-[#1F3A33]/30"
          />
          <button type="submit" disabled={!text.trim() || typing} aria-label={ui.send} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#1F3A33] text-white disabled:opacity-40">
            <SendHorizontal className="h-[18px] w-[18px]" />
          </button>
        </form>
      </div>

      <AgentInsights view={view} />
    </div>
  );
}
