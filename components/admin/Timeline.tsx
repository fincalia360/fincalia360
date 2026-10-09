import Link from "next/link";
import { EVENT_LABELS } from "@/lib/labels";
import { formatDateTime, parseJSON } from "@/lib/utils";

const DOT: Record<string, string> = {
  LEAD_CREATED: "bg-sky-500",
  LEAD_QUALIFIED: "bg-amber-500",
  APPOINTMENT_BOOKED: "bg-terracotta-500",
  LEAD_ASSIGNED: "bg-violet-500",
  LEAD_CONVERTED: "bg-pine-500",
  LEAD_LOST: "bg-ink-300",
};

interface TimelineEvent {
  id: string;
  type: string;
  createdAt: Date;
  payload: string | null;
  lead?: { id: string; name: string } | null;
}

function describe(type: string, payload: Record<string, unknown>) {
  const parts: string[] = [];
  if (type === "LEAD_CREATED" && payload.score != null) parts.push(`Score ${payload.score} · ${payload.tier}`);
  if (type === "LEAD_ASSIGNED" && payload.agencyName) parts.push(String(payload.agencyName));
  if (type === "APPOINTMENT_BOOKED" && payload.scheduledAt) parts.push(formatDateTime(String(payload.scheduledAt)));
  if (type === "STATUS_CHANGED") parts.push(`${payload.from} → ${payload.to}`);
  if (type === "LEAD_LOST" && payload.reason) parts.push(String(payload.reason));
  if (type === "NOTE_ADDED" && payload.preview) parts.push(`“${payload.preview}”`);
  const n = payload.notification as { audience?: string; to?: string; channel?: string } | undefined;
  if (n?.audience) parts.push(`Notificación ${n.channel ?? "demo"} → ${n.audience === "agency" ? "inmobiliaria" : n.audience === "owner" ? "propietario" : "equipo"}${n.to ? ` (${n.to})` : ""}`);
  return parts;
}

export function Timeline({ events, showLead }: { events: TimelineEvent[]; showLead?: boolean }) {
  if (!events.length) return <p className="text-sm text-ink-400">Sin eventos todavía.</p>;
  return (
    <ol className="relative space-y-4 border-l border-sand-200 pl-5">
      {events.map((e) => {
        const payload = parseJSON<Record<string, unknown>>(e.payload, {});
        return (
          <li key={e.id} className="relative">
            <span className={`absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white ${DOT[e.type] ?? "bg-ink-400"}`} />
            <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
              <span className="font-medium text-ink-800">{EVENT_LABELS[e.type] ?? e.type}</span>
              {showLead && e.lead && (
                <Link href={`/admin/leads/${e.lead.id}`} className="text-terracotta-600 hover:underline">
                  {e.lead.name}
                </Link>
              )}
              <span className="text-xs text-ink-400">{formatDateTime(e.createdAt)}</span>
            </div>
            {describe(e.type, payload).map((line) => (
              <p key={line} className="mt-0.5 text-[13px] text-ink-500">
                {line}
              </p>
            ))}
          </li>
        );
      })}
    </ol>
  );
}
