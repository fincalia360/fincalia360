"use client";

import { cn } from "@/lib/utils";
import type { Slot } from "@/types";

/** Calendario DEMO: horarios ficticios agrupados por día. */
export function SlotPicker({
  slots,
  labels,
  locale,
  onSelect,
  disabled,
  compact,
}: {
  slots: Slot[];
  labels: { today: string; tomorrow: string };
  locale: string;
  onSelect: (slot: Slot) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const groups = new Map<string, Slot[]>();
  for (const slot of slots) {
    const key = new Date(slot.iso).toDateString();
    groups.set(key, [...(groups.get(key) ?? []), slot]);
  }

  const dayLabel = (slot: Slot) => {
    if (slot.dayKey === "today") return labels.today;
    if (slot.dayKey === "tomorrow") return labels.tomorrow;
    const label = new Date(slot.iso).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "short" });
    return label.charAt(0).toUpperCase() + label.slice(1);
  };

  return (
    <div className={cn("space-y-4", compact && "space-y-3")}>
      {[...groups.values()].map((daySlots) => (
        <div key={daySlots[0].iso}>
          <p className={cn("mb-2 font-medium text-ink-700", compact ? "text-xs" : "text-sm")}>{dayLabel(daySlots[0])}</p>
          <div className="flex flex-wrap gap-2">
            {daySlots.map((slot) => (
              <button
                key={slot.iso}
                type="button"
                disabled={disabled}
                onClick={() => onSelect(slot)}
                className={cn(
                  "rounded-lg border border-sand-300 bg-white font-medium tabular-nums text-ink-800 transition hover:border-terracotta-400 hover:bg-terracotta-50 disabled:opacity-50",
                  compact ? "px-3 py-1.5 text-[13px]" : "px-4 py-2 text-sm",
                )}
              >
                {slot.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
