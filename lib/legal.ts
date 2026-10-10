// Datos del titular de la web para los textos legales (LSSI art. 10, RGPD art. 13).
// Se configuran con variables de entorno al publicar la web; nunca se inventan.
// Mientras falte alguno, las páginas legales muestran un aviso visible.

export const LEGAL_UPDATED = "10 de octubre de 2026";

const FIELDS = {
  ownerName: { env: "LEGAL_OWNER_NAME", label: "Nombre o razón social del titular", required: true },
  ownerId: { env: "LEGAL_OWNER_NIF", label: "NIF / CIF", required: true },
  ownerAddress: { env: "LEGAL_OWNER_ADDRESS", label: "Domicilio", required: true },
  contactEmail: { env: "LEGAL_CONTACT_EMAIL", label: "Email de contacto y de protección de datos", required: true },
  registry: { env: "LEGAL_OWNER_REGISTRY", label: "Datos registrales (Registro Mercantil), si es una sociedad", required: false },
  hosting: { env: "LEGAL_HOSTING_PROVIDER", label: "Proveedor de alojamiento y región de los servidores", required: false },
  siteUrl: { env: "SITE_URL", label: "Dirección de la web", required: false },
} as const;

export type LegalKey = keyof typeof FIELDS;

export function legalValue(key: LegalKey): string | null {
  const v = process.env[FIELDS[key].env]?.trim();
  return v ? v : null;
}

export function legalLabel(key: LegalKey) {
  return FIELDS[key].label;
}

/** Datos obligatorios que faltan (se muestran como aviso en las páginas legales). */
export function missingLegalData() {
  return (Object.keys(FIELDS) as LegalKey[]).filter((k) => FIELDS[k].required && !legalValue(k)).map((k) => FIELDS[k].label);
}
