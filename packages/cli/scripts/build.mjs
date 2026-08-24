import { rm } from "node:fs/promises";
import { build } from "esbuild";

const packageRoot = new URL("../", import.meta.url);
const outputDirectory = new URL("dist/", packageRoot);

await rm(outputDirectory, { force: true, recursive: true });
await build({
  bundle: true,
  entryPoints: [new URL("src/main.ts", packageRoot).pathname],
  format: "esm",
  legalComments: "none",
  outfile: new URL("main.js", outputDirectory).pathname,
  platform: "node",
  target: "node24",
});
