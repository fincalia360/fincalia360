import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import type { Dictionary } from "@/lib/i18n";
import type { Language } from "@/types";

export function SiteFooter({ dict, lang }: { dict: Dictionary; lang: Language }) {
  return (
    <footer className="bg-ink-800 text-ink-100">
      <div className="container-page grid gap-8 py-12 md:grid-cols-[1.4fr_1fr]">
        <div>
          <Logo light />
          <p className="mt-4 max-w-sm text-sm text-sand-300/80">{dict.footer.tagline}</p>
        </div>
        <div className="flex flex-col gap-2 text-sm md:items-end">
          <Link href={`/privacy?lang=${lang}`} className="hover:text-white">{dict.footer.privacy}</Link>
          <Link href={`/legal?lang=${lang}`} className="hover:text-white">{dict.footer.legal}</Link>
          <Link href="/admin" className="text-sand-300/60 hover:text-white">CRM ↗</Link>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="container-page py-4 text-xs text-sand-300/70">
          © {new Date().getFullYear()} FINCALIA360 · {dict.footer.demo}
        </p>
      </div>
    </footer>
  );
}
