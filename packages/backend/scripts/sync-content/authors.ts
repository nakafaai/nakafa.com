import { readMdxFile } from "../lib/mdx-parser/content";
import { runConvexMutationGeneric } from "./convexApi";
import { formatDuration, log } from "./logging";
import { globFiles } from "./runtime";
import { AuthorSyncResultSchema, BATCH_SIZES } from "./schemas";
import type { AuthorSyncResult, ConvexConfig, SyncOptions } from "./types";

export const collectAllAuthorNames = async (
  options: SyncOptions
): Promise<string[]> => {
  const authorNames: string[] = [];
  const patterns = [
    options.locale ? `articles/**/${options.locale}.mdx` : "articles/**/*.mdx",
    options.locale ? `subject/**/${options.locale}.mdx` : "subject/**/*.mdx",
    options.locale
      ? `exercises/**/_question/${options.locale}.mdx`
      : "exercises/**/_question/*.mdx",
  ];

  for (const pattern of patterns) {
    const files = await globFiles(pattern);
    for (const file of files) {
      try {
        const { metadata } = await readMdxFile(file);
        authorNames.push(...metadata.authors.map((author) => author.name));
      } catch {
        // Ignore invalid content files while collecting authors.
      }
    }
  }

  return [...new Set(authorNames)];
};

export const collectAuthorNamesFromFiles = async (
  filePaths: string[]
): Promise<string[]> => {
  const authorNames: string[] = [];

  for (const file of filePaths) {
    try {
      const { metadata } = await readMdxFile(file);
      authorNames.push(...metadata.authors.map((author) => author.name));
    } catch {
      // Ignore files that do not have parsable MDX metadata.
    }
  }

  return [...new Set(authorNames)];
};

export const syncAuthors = async (
  config: ConvexConfig,
  options: SyncOptions
): Promise<AuthorSyncResult> => {
  const startTime = performance.now();

  if (!options.quiet) {
    log("Collecting author names from content files...");
  }

  const authorNames = await collectAllAuthorNames(options);

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
    const result = await runConvexMutationGeneric(
      config,
      "contentSync/mutations/authors:bulkSyncAuthors",
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
};
