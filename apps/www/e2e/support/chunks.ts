import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import type { Page } from "@playwright/test";
import { Array as Arr, Effect, FileSystem, MutableList, Path } from "effect";
import { rendererChunkName } from "#www/output.config";

/** A chunk of the production build: its name, then the 8 characters of its hash. */
const CHUNK = /^(?<name>.+)-[\w-]{8}\.js$/u;

/** Records the file name of every script a page loads, in order. */
export function recordScripts(page: Page) {
  const scripts = MutableList.make<string>();
  page.on("response", (response) => {
    if (response.request().resourceType() === "script") {
      const path = new URL(response.url()).pathname;
      MutableList.append(scripts, path.slice(path.lastIndexOf("/") + 1));
    }
  });
  return scripts;
}

/** The file names of the scripts the production build wrote for the browser. */
export const builtChunks = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const assets = path.resolve(import.meta.dirname, "../../dist/client/assets");
  return Arr.filter(yield* fs.readDirectory(assets), (file) =>
    file.endsWith(".js")
  );
}).pipe(Effect.provide(nodeServicesLayer));

/**
 * The built chunks of one lazy renderer of the catalog, which the build names after its module's
 * path, such as `catalog-contents-biology-virus-structure-Ko6J8qSW.js`.
 */
export function rendererChunks(chunks: readonly string[], module: string) {
  const name = rendererChunkName(module);
  return Arr.filter(
    chunks,
    (chunk) => CHUNK.exec(chunk)?.groups?.name === name
  );
}
