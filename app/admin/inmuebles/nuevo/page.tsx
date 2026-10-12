import Link from "next/link";
import { ArrowLeft, ImagePlus } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { ListingForm } from "@/components/listings/ListingForm";
import { requireAdmin } from "@/lib/auth";
import { PROVINCES } from "@/services/study/geo";
import { isPortalProvince } from "@/services/listings/catalog";
import { aiCopyAction, createListingAction } from "../actions";

export const metadata = { title: "Nuevo anuncio" };

export default async function NewListingPage({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  await requireAdmin();
  const tipo = (await searchParams).tipo;
  const mooring = tipo === "amarre";
  const business = tipo === "negocio";
  const provinces = PROVINCES.filter((p) => isPortalProvince(p.code)).sort((a, b) => a.name.localeCompare(b.name, "es")).map(({ code, name }) => ({ code, name }));
  return (
    <div className="max-w-4xl">
      <Link href="/admin/inmuebles" className="mb-3 inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800">
        <ArrowLeft className="h-4 w-4" /> Anuncios
      </Link>
      <PageHeader
        title={mooring ? "Nuevo amarre" : business ? "Nuevo traspaso de negocio" : "Nuevo anuncio"}
        description="Se guarda como borrador. Después podrás subir las fotos, el documento de autorización y publicarlo."
      />
      <div className="mb-5 flex items-start gap-3 rounded-2xl border border-dashed border-ink-200 bg-white p-4 text-sm text-ink-600">
        <ImagePlus className="mt-0.5 h-5 w-5 shrink-0 text-terracotta-500" />
        <p>
          <strong className="text-ink-800">¿Y las fotos?</strong> Se suben en el paso siguiente: rellena los datos, pulsa <strong>«Guardar borrador»</strong> y en la
          página que se abre verás el botón <strong>«Subir fotos»</strong> (puedes elegir varias a la vez).
        </p>
      </div>
      <ListingForm action={createListingAction} provinces={provinces} submitLabel="Guardar borrador" category={mooring ? "MOORING" : business ? "BUSINESS" : "HOME"} aiAction={aiCopyAction} />
    </div>
  );
}
