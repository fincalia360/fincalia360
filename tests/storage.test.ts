// La carpeta de fotos siempre queda dentro del proyecto (o donde diga UPLOAD_DIR), aunque el servidor
// se arranque desde la carpeta superior: nunca se escribe fuera del proyecto por accidente.
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { isValidKey, newKey, uploadRoot } from "@/services/storage/storage";

const project = path.resolve(__dirname, "..");
const originalCwd = process.cwd();

afterEach(() => {
  process.chdir(originalCwd);
  delete process.env.UPLOAD_DIR;
});

describe("almacenamiento de archivos", () => {
  it("por defecto usa <proyecto>/storage, también arrancando desde la carpeta superior", () => {
    delete process.env.UPLOAD_DIR;
    process.chdir(project);
    expect(uploadRoot()).toBe(path.join(project, "storage"));
    process.chdir(path.dirname(project));
    expect(uploadRoot()).toBe(path.join(project, "storage"));
  });

  it("respeta UPLOAD_DIR (disco persistente en producción)", () => {
    process.env.UPLOAD_DIR = path.join(project, "tmp-uploads-test");
    expect(uploadRoot()).toBe(path.join(project, "tmp-uploads-test"));
  });

  it("solo acepta claves generadas por la aplicación (sin rutas relativas)", () => {
    expect(isValidKey(newKey("public", "listings", "webp"))).toBe(true);
    expect(isValidKey(newKey("private", "authorizations", "pdf"))).toBe(true);
    expect(isValidKey("public/listings/../../.env")).toBe(false);
    expect(isValidKey("public/listings/abc.exe")).toBe(false);
    expect(isValidKey("../storage/public/x.webp")).toBe(false);
  });
});
