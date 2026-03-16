import { readMdxFile } from "../lib/mdx-parser/content";
import { runConvexMutationGeneric } from "./convexApi";
import { formatDuration, log } from "./logging";
import { globFiles } from "./runtime";
import { AuthorSyncResultSchema } from "./schemas";
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

  const result = await runConvexMutationGeneric(
    config,
    "contentSync/mutations:bulkSyncAuthors",
    { authorNames },
    AuthorSyncResultSchema
  );
  const durationMs = performance.now() - startTime;

  if (!options.quiet) {
    log(`Authors: ${result.created} created, ${result.existing} existing`);
    log(`Duration: ${formatDuration(durationMs)}`);
  }

  return { ...result, durationMs };
};
