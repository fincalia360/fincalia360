"use client";

import { useEffect, useRef } from "react";
import { track } from "@/lib/analytics-client";
import type { AnalyticsEventType } from "@/types";

export function TrackOnMount({ type, payload, leadId }: { type: AnalyticsEventType; payload?: Record<string, unknown>; leadId?: string }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    track(type, payload, leadId);
  }, [type, payload, leadId]);
  return null;
}
