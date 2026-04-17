import { serveDir } from "jsr:@std/http/file-server";

Deno.serve({ port: 8000 }, (req) => {
  return serveDir(req, {
    fsRoot: "dist/form-guests/browser",
    urlRoot: "",
    quiet: true,
  });
});
