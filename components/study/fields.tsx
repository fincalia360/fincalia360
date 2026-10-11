"use client";

import { useStudyT } from "@/components/study/StudyI18n";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  optional,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: string;
  optional?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const t = useStudyT();
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="field-label">
        {label}
        {optional && <span className="ml-1.5 text-xs font-normal text-ink-400">{t("(opcional)")}</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
      {error && (
        <p className="mt-1 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function NumberInput({
  id,
  value,
  onChange,
  suffix,
  placeholder,
  min = 0,
  step,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  suffix?: string;
  placeholder?: string;
  min?: number;
  step?: number | string;
}) {
  return (
    <div className="relative">
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        step={step}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn("field tabular-nums", suffix && "pr-14")}
      />
      {suffix && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-ink-400">{suffix}</span>}
    </div>
  );
}

export function ChoiceGroup<T extends string>({
  options,
  value,
  onChange,
  columns = "grid-cols-2 sm:grid-cols-3",
  name,
}: {
  options: Array<{ value: T; label: string; hint?: string }>;
  value: T | null;
  onChange: (v: T) => void;
  columns?: string;
  name: string;
}) {
  return (
    <div role="radiogroup" aria-label={name} className={cn("grid gap-2", columns)}>
      {options.map((o) => {
        const selected = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex min-h-[48px] items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-left text-sm transition",
              selected ? "border-ink-800 bg-ink-800 text-white" : "border-sand-300 bg-white text-ink-700 hover:border-ink-300",
            )}
          >
            <span>
              {o.label}
              {o.hint && <span className={cn("block text-xs", selected ? "text-sand-200" : "text-ink-400")}>{o.hint}</span>}
            </span>
            {selected && <Check className="h-4 w-4 shrink-0" />}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition",
        checked ? "border-ink-800 bg-ink-800 text-white" : "border-sand-300 bg-white text-ink-600 hover:border-ink-300",
      )}
    >
      {checked && <Check className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}
