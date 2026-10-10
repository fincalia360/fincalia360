import { redirect } from "next/navigation";

/** /amarres lleva a los amarres en venta (desde allí se cambia a alquiler). */
export default function MooringsIndex() {
  redirect("/amarres/comprar");
}
