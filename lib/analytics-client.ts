"use client";

import type { AnalyticsEventType } from "@/types";

const KEY = "fincalia360_session";

export function getSessionId(): string {
  try {
    let id = window.sessionStorage.getItem(KEY);
    if (!id) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      window.sessionStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "anonymous";
  }
}

/** Envía un evento de analítica propia (sin terceros). Nunca rompe la UI. */
export function track(type: AnalyticsEventType, payload?: Record<string, unknown>, leadId?: string) {
  try {
    void fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, payload, leadId, sessionId: getSessionId() }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // ignorar
  }
}
