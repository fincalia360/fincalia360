import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { ContactForm } from "@/components/agency/ContactForm";
import { Card, CardBody } from "@/components/ui/Card";
import { requireAgency } from "@/services/agency/auth";
import { createContactAction } from "../../actions";

export const metadata = { title: "Nuevo contacto" };

export default async function NewContactPage() {
  await requireAgency();
  return (
    <div className="max-w-3xl">
      <Link href="/zona-inmobiliarias/panel/contactos" className="mb-3 inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800">
        <ArrowLeft className="h-4 w-4" /> Contactos
      </Link>
      <PageHeader title="Nuevo contacto" description="Si ya existe un contacto con el mismo email o teléfono, te lo indicaremos para no duplicarlo." />
      <Card>
        <CardBody className="p-6">
          <ContactForm action={createContactAction} submitLabel="Crear contacto" />
        </CardBody>
      </Card>
    </div>
  );
}
