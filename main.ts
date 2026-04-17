import { serveDir, serveFile } from "jsr:@std/http/file-server";

const ROOT = "./dist/form-guests/browser";

Deno.serve(async (req: Request) => {
  const res = await serveDir(req, { fsRoot: ROOT, quiet: true });
  // SPA fallback: cualquier ruta no encontrada devuelve index.html
  if (res.status === 404) {
    return serveFile(req, `${ROOT}/index.html`);
  }
  return res;
});
