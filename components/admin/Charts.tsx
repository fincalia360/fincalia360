import { formatNumber, formatPercent } from "@/lib/utils";

/** Columnas simples (SVG/CSS, sin librerías). */
export function BarChart({ data, height = 160 }: { data: Array<{ label: string; value: number; title?: string }>; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div>
      <div className="flex items-end gap-1.5" style={{ height }}>
        {data.map((d, i) => (
          <div key={i} className="group relative flex h-full flex-1 flex-col justify-end">
            <span className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-ink-800 px-1.5 py-0.5 text-[11px] text-white opacity-0 transition group-hover:opacity-100">
              {d.title ?? d.label}: {d.value}
            </span>
            <div
              className="w-full rounded-t-[4px] bg-ink-700 transition-colors group-hover:bg-terracotta-500"
              style={{ height: `${Math.max(d.value ? 4 : 1, (d.value / max) * 100)}%`, opacity: d.value ? 1 : 0.15 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-1.5 border-t border-sand-200 pt-2">
        {data.map((d, i) => (
          <span key={i} className="flex-1 text-center text-[10px] tabular-nums text-ink-400">
            {i % 2 === 0 || data.length <= 8 ? d.label : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Embudo horizontal con conversión entre pasos. */
export function Funnel({ steps }: { steps: Array<{ label: string; value: number; hint?: string }> }) {
  const max = Math.max(1, steps[0]?.value ?? 1);
  return (
    <ol className="space-y-3">
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1].value : null;
        const rate = prev ? s.value / prev : null;
        return (
          <li key={s.label}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium text-ink-700">
                {s.label}
                {s.hint && <span className="ml-2 text-xs font-normal text-ink-400">{s.hint}</span>}
              </span>
              <span className="tabular-nums text-ink-800">
                {formatNumber(s.value)}
                {rate !== null && <span className="ml-2 text-xs text-ink-400">{formatPercent(rate)}</span>}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-sand-100">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(2, (s.value / max) * 100)}%`, background: i === steps.length - 1 ? "#238477" : "#213851", opacity: 1 - i * 0.12 }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
