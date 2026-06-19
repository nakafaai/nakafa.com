import { internal } from "@repo/backend/convex/_generated/api";
import { readMdxFile } from "@repo/backend/scripts/lib/mdx-parser/content";
import { callConvexMutation } from "@repo/backend/scripts/sync-content/convex";
import {
  formatDuration,
  log,
} from "@repo/backend/scripts/sync-content/logging";
import { globFiles } from "@repo/backend/scripts/sync-content/runtime";
import {
  AuthorSyncResultSchema,
  BATCH_SIZES,
} from "@repo/backend/scripts/sync-content/schemas";
import type {
  ConvexConfig,
  SyncOptions,
} from "@repo/backend/scripts/sync-content/types";
import { Effect } from "effect";

const readAuthorNames = Effect.fn("sync.readAuthorNames")(function* (
  file: string
) {
  const result = yield* Effect.either(readMdxFile(file));

  if (result._tag === "Left") {
    return [];
  }

  return result.right.metadata.authors.map((author) => author.name);
});

/** Collects all unique content author names for the requested locale. */
export const collectAllAuthorNames = Effect.fn("sync.collectAllAuthorNames")(
  function* (options: SyncOptions) {
    const authorNames: string[] = [];
    const patterns = [
      options.locale
        ? `articles/**/${options.locale}.mdx`
        : "articles/**/*.mdx",
      options.locale
        ? `material/lesson/**/${options.locale}.mdx`
        : "material/lesson/**/*.mdx",
      options.locale
        ? `material/practice/**/question.${options.locale}.mdx`
        : "material/practice/**/question.*.mdx",
    ];

    for (const pattern of patterns) {
      const files = yield* globFiles(pattern);

      for (const file of files) {
        authorNames.push(...(yield* readAuthorNames(file)));
      }
    }

    return [...new Set(authorNames)];
  }
);

/** Collects unique author names from a known set of changed content files. */
export const collectAuthorNamesFromFiles = Effect.fn(
  "sync.collectAuthorNamesFromFiles"
)(function* (filePaths: string[]) {
  const authorNames: string[] = [];

  for (const file of filePaths) {
    authorNames.push(...(yield* readAuthorNames(file)));
  }

  return [...new Set(authorNames)];
});

/** Syncs missing content authors before content rows reference them. */
export const syncAuthors = Effect.fn("sync.authors")(function* (
  config: ConvexConfig,
  options: SyncOptions
) {
  const startTime = performance.now();

  if (!options.quiet) {
    log("Collecting author names from content files...");
  }

  const authorNames = yield* collectAllAuthorNames(options);

  if (!options.quiet) {
    log(`Unique authors found: ${authorNames.length}`);
  }

  if (authorNames.length === 0) {
    return {
      created: 0,
      existing: 0,
      durationMs: performance.now() - startTime,
    };
  }

  let created = 0;
  let existing = 0;

  for (
    let index = 0;
    index < authorNames.length;
    index += BATCH_SIZES.authors
  ) {
    const batch = authorNames.slice(index, index + BATCH_SIZES.authors);
    const result = yield* callConvexMutation(
      config,
      internal.contentSync.mutations.authors.bulkSyncAuthors,
      { authorNames: batch },
      AuthorSyncResultSchema
    );

    created += result.created;
    existing += result.existing;
  }

  const durationMs = performance.now() - startTime;

  if (!options.quiet) {
    log(`Authors: ${created} created, ${existing} existing`);
    log(`Duration: ${formatDuration(durationMs)}`);
  }

  return { created, existing, durationMs };
});
