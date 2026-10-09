import { cn } from "@/lib/utils";
import { ORIGIN_LABELS, type DataOrigin, type Series } from "@/services/study/types";

const ORIGIN_STYLES: Record<DataOrigin, string> = {
  OFFICIAL: "bg-pine-50 text-pine-600 ring-pine-100",
  OWNER: "bg-sky-50 text-sky-700 ring-sky-200",
  MARKET_OBSERVED: "bg-violet-50 text-violet-700 ring-violet-200",
  MODEL: "bg-ink-50 text-ink-600 ring-ink-100",
  ASSUMPTION: "bg-amber-50 text-amber-700 ring-amber-200",
  EXAMPLE: "bg-red-50 text-red-700 ring-red-200",
};

export function OriginBadge({ origin, className }: { origin: DataOrigin; className?: string }) {
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset", ORIGIN_STYLES[origin], className)}>
      {ORIGIN_LABELS[origin]}
    </span>
  );
}

export const eur = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? "—" : new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
export const pct = (v: number | null | undefined, digits = 1) =>
  v == null || !Number.isFinite(v) ? "—" : `${(v * 100).toLocaleString("es-ES", { maximumFractionDigits: digits, minimumFractionDigits: digits })} %`;

/** Barras horizontales para comparar escenarios. */
export function ScenarioBars({ items }: { items: Array<{ label: string; value: number; tone: "accent" | "ink" | "muted"; hint?: string }> }) {
  const max = Math.max(1, ...items.map((i) => Math.abs(i.value)));
  const tones = { accent: "bg-terracotta-500", ink: "bg-ink-700", muted: "bg-ink-300" };
  return (
    <div className="space-y-3">
      {items.map((it) => (
        <div key={it.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium text-ink-700">{it.label}</span>
            <span className="font-semibold tabular-nums text-ink-800">{eur(it.value)}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-sand-100">
            <div className={cn("h-full rounded-full", it.value < 0 ? "bg-red-500" : tones[it.tone])} style={{ width: `${Math.max(1.5, (Math.abs(it.value) / max) * 100)}%` }} />
          </div>
          {it.hint && <p className="mt-1 text-xs text-ink-400">{it.hint}</p>}
        </div>
      ))}
    </div>
  );
}

/** Línea sencilla (SVG) para series históricas. */
export function LineChart({ series, height = 120 }: { series: Series; height?: number }) {
  const pts = series.points;
  if (pts.length < 2) return <p className="text-sm text-ink-400">Serie insuficiente.</p>;
  const values = pts.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const W = 320;
  const H = height;
  const pad = 6;
  const x = (i: number) => pad + (i / (pts.length - 1)) * (W - 2 * pad);
  const y = (v: number) => H - pad - ((v - min) / span) * (H - 2 * pad);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const fmt = (v: number) => v.toLocaleString("es-ES", { maximumFractionDigits: 2 });
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${series.label}: de ${fmt(values[0])} a ${fmt(values[values.length - 1])} ${series.unit}`}>
        <path d={d} fill="none" stroke="#1E364D" strokeWidth="2" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <circle key={p.period} cx={x(i)} cy={y(p.value)} r={i === pts.length - 1 ? 3.5 : 2} fill={i === pts.length - 1 ? "#B5562F" : "#1E364D"}>
            <title>{`${p.period}: ${fmt(p.value)} ${series.unit}`}</title>
          </circle>
        ))}
      </svg>
      <figcaption className="mt-1 flex justify-between text-[11px] tabular-nums text-ink-400">
        <span>
          {pts[0].period}: {fmt(pts[0].value)}
        </span>
        <span>
          {pts[pts.length - 1].period}: <strong className="text-ink-700">{fmt(pts[pts.length - 1].value)}</strong> {series.unit}
        </span>
      </figcaption>
    </figure>
  );
}
