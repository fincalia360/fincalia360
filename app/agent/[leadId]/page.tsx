import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AgentChat } from "@/components/agent/AgentChat";
import { Logo } from "@/components/brand/Logo";
import { prisma } from "@/db/client";
import { getDictionary } from "@/lib/i18n";
import { getConversationView } from "@/services/agentService";
import type { Language } from "@/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Conversación con agente" };

export default async function AgentPage({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  const exists = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true } });
  if (!exists) notFound();

  const view = await getConversationView(leadId);
  const dict = getDictionary(view.language as Language);

  return (
    <div className="min-h-screen bg-sand-100">
      <header className="border-b border-sand-200 bg-sand-50">
        <div className="container-page flex h-14 items-center justify-between gap-3">
          <Link href={`/admin/leads/${leadId}`} className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800">
            <ArrowLeft className="h-4 w-4" /> Ficha del lead
          </Link>
          <Logo className="scale-90" />
          <span className="hidden text-sm text-ink-400 sm:block">{view.leadName}</span>
        </div>
      </header>
      <main className="container-page py-5 sm:py-8">
        <AgentChat initialView={view} dict={dict} />
      </main>
    </div>
  );
}
