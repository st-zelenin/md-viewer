import { cpSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(root, "public");
const vendor = join(publicDir, "vendor");

function copy(src, dest) {
  cpSync(join(root, src), join(vendor, dest), { recursive: true });
}

rmSync(vendor, { recursive: true, force: true });
mkdirSync(vendor, { recursive: true });

copy("node_modules/highlight.js/styles", "highlight.js/styles");

console.log("Prepared public/vendor");
