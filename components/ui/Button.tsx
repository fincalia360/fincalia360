import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "primary" | "accent" | "outline" | "ghost" | "danger" | "light";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-ink-800 text-white hover:bg-ink-700 shadow-sm",
  accent: "bg-terracotta-500 text-white hover:bg-terracotta-600 shadow-sm",
  outline: "border border-sand-300 bg-white text-ink-800 hover:border-ink-300 hover:bg-sand-50",
  ghost: "text-ink-600 hover:bg-sand-100 hover:text-ink-800",
  danger: "border border-red-200 bg-white text-red-700 hover:bg-red-50",
  light: "bg-white text-ink-800 hover:bg-sand-100 shadow-sm",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-[15px] gap-2",
};

interface Common {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
}

export function buttonClasses({ variant = "primary", size = "md", className }: Omit<Common, "children">) {
  return cn(
    "inline-flex items-center justify-center whitespace-nowrap rounded-full font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

export function Button({
  variant,
  size,
  className,
  children,
  ...props
}: Common & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={buttonClasses({ variant, size, className })} {...props}>
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant,
  size,
  className,
  children,
  ...props
}: Common & { href: string } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  return (
    <Link href={href} className={buttonClasses({ variant, size, className })} {...props}>
      {children}
    </Link>
  );
}
