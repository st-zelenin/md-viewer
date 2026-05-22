import * as esbuild from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

await esbuild.build({
  entryPoints: [join(root, "public/src/viewer.js")],
  outfile: join(root, "public/app.js"),
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["safari14"],
  minify: false,
});

console.log("Bundled public/app.js");
