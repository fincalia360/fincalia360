import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AgencyForm } from "@/components/admin/AgencyForm";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";

export const metadata = { title: "Nuevo colaborador" };

export default function NewAgencyPage() {
  return (
    <>
      <Link href="/admin/agencies" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800">
        <ArrowLeft className="h-4 w-4" /> Inmobiliarias
      </Link>
      <PageHeader title="Nuevo colaborador" />
      <Card className="max-w-3xl">
        <CardBody className="p-6">
          <AgencyForm />
        </CardBody>
      </Card>
    </>
  );
}
