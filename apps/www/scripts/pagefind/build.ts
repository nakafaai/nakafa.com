import { rm } from "node:fs/promises";
import { createServiceLogger } from "@repo/utilities/logging";
import {
  addArticleRecords,
  addExerciseRecords,
  addQuranRecords,
  addSubjectRecords,
} from "./records";

const OUTPUT_PATH = "public/_pagefind";
const logger = createServiceLogger("pagefind");

/**
 * Builds the production Pagefind bundle from source-of-truth content instead of
 * scanning Next.js build artifacts.
 *
 * Why this exists:
 * - With Next.js Cache Components / PPR, some `.next/server/app` artifacts do
 *   not contain fully rendered learn-page DOM.
 * - Pagefind's HTML scan mode indexes HTML files, so shell-oriented artifacts
 *   can under-index content or index inconsistent payloads.
 * - Pagefind exposes official custom-record and HTML-file APIs, so we can index
 *   the content we own rather than scrape implementation-specific build output.
 *
 * References:
 * - Next.js Cache Components guide:
 *   https://nextjs.org/docs/app/getting-started/cache-components
 * - Next.js `use cache` directive:
 *   https://nextjs.org/docs/app/api-reference/directives/use-cache
 * - Pagefind indexing docs:
 *   https://pagefind.app/docs/indexing/
 * - Installed Pagefind API surface:
 *   `apps/www/node_modules/pagefind/types/index.d.ts`
 */
export async function buildPagefindIndex() {
  const { createIndex } = await import("pagefind");

  await rm(OUTPUT_PATH, { force: true, recursive: true });

  const response = await createIndex();

  if (!response.index) {
    throw new Error(
      response.errors.join("\n") || "Failed to create Pagefind index"
    );
  }

  const { index } = response;
  let count = 0;
  let words = 0;

  for (const add of [
    addArticleRecords,
    addSubjectRecords,
    addExerciseRecords,
    addQuranRecords,
  ]) {
    const result = await add(index);
    count += result.count;
    words += result.words;
  }

  const write = await index.writeFiles({ outputPath: OUTPUT_PATH });

  if (write.errors.length > 0) {
    throw new Error(write.errors.join("\n"));
  }

  logger.info(
    { count, outputPath: write.outputPath, words },
    "Indexed Pagefind source records"
  );
}

/**
 * Logs the Pagefind failure and exits with a non-zero code.
 */
export function handlePagefindError(error: unknown) {
  logger.error({ error }, "Pagefind build failed");
  process.exitCode = 1;
}
