import { cn } from "@/lib/utils";

export function StatCard({ label, value, hint, accent }: { label: string; value: React.ReactNode; hint?: React.ReactNode; accent?: boolean }) {
  return (
    <div className={cn("rounded-2xl border p-4 shadow-soft sm:p-5", accent ? "border-terracotta-100 bg-terracotta-50" : "border-sand-200 bg-white")}>
      <p className="text-[12px] font-medium uppercase tracking-wider text-ink-400">{label}</p>
      <p className="mt-2 font-serif text-[32px] font-medium leading-none tabular-nums text-ink-800">{value}</p>
      {hint && <p className="mt-2 text-xs text-ink-400">{hint}</p>}
    </div>
  );
}
