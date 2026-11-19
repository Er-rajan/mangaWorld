import { cp, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const source = dirname(require.resolve("pdfjs-dist/package.json"));
const target = "public/pdfjs";
await mkdir(target, { recursive: true });
await Promise.all([
  cp(join(source, "build/pdf.worker.min.mjs"), join(target, "pdf.worker.min.mjs")),
  ...["cmaps", "standard_fonts", "wasm", "iccs"].map((name) =>
    cp(join(source, name), join(target, name), { recursive: true }),
  ),
]);
