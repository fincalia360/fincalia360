// Las fuentes oficiales (Catastro, INE…) a veces fallan de forma momentánea: se reintenta una vez.
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchJson } from "@/services/study/sources/http";

afterEach(() => vi.unstubAllGlobals());

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

describe("descarga de fuentes oficiales", () => {
  it("reintenta si la conexión se corta (conexión reutilizada cerrada por el servidor)", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError("fetch failed")).mockResolvedValueOnce(ok({ ok: 1 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchJson("https://ovc.catastro.meh.es/x")).resolves.toEqual({ ok: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reintenta ante un error temporal 503", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("", { status: 503 })).mockResolvedValueOnce(ok([1]));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchJson("https://ovc.catastro.meh.es/x")).resolves.toEqual([1]);
  });

  it("no reintenta un 404 y avisa si la respuesta no es JSON", async () => {
    const notFound = vi.fn().mockResolvedValue(new Response("", { status: 404 }));
    vi.stubGlobal("fetch", notFound);
    await expect(fetchJson("https://ovc.catastro.meh.es/x")).rejects.toThrow(/HTTP 404/);
    expect(notFound).toHaveBeenCalledTimes(1);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>error</html>", { status: 200 })));
    await expect(fetchJson("https://ovc.catastro.meh.es/x")).rejects.toThrow(/Respuesta no válida/);
  });
});
