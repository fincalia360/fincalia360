import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { ListingForm } from "@/components/listings/ListingForm";
import { requireAdmin } from "@/lib/auth";
import { PROVINCES } from "@/services/study/geo";
import { createListingAction } from "../actions";

export const metadata = { title: "Nuevo inmueble" };

export default async function NewListingPage() {
  await requireAdmin();
  const provinces = [...PROVINCES].sort((a, b) => a.name.localeCompare(b.name, "es")).map(({ code, name }) => ({ code, name }));
  return (
    <div className="max-w-4xl">
      <Link href="/admin/inmuebles" className="mb-3 inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800">
        <ArrowLeft className="h-4 w-4" /> Inmuebles
      </Link>
      <PageHeader title="Nuevo inmueble" description="Se guarda como borrador. Después podrás subir las fotos, el documento de autorización y publicarlo." />
      <ListingForm action={createListingAction} provinces={provinces} submitLabel="Guardar borrador" />
    </div>
  );
}
