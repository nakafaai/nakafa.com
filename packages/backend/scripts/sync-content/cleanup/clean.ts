import { internal } from "@repo/backend/convex/_generated/api";
import { collectFilesystemArticleCurriculumSlugs } from "@repo/backend/scripts/sync-content/cleanup/source";
import {
  log,
  logStaleItems,
  logSuccess,
} from "@repo/backend/scripts/sync-content/cli/logging";
import { DeleteResultSchema } from "@repo/backend/scripts/sync-content/contract/inspection";
import { BATCH_SIZES } from "@repo/backend/scripts/sync-content/contract/schemas";
import type {
  ConvexConfig,
  StaleItem,
  SyncOptions,
} from "@repo/backend/scripts/sync-content/contract/types";
import { callConvexMutation } from "@repo/backend/scripts/sync-content/convex/client";
import {
  getStaleArticleCurriculumContent,
  getUnusedAuthors,
} from "@repo/backend/scripts/sync-content/convex/inspection";
import type {
  DefaultFunctionArgs,
  FunctionArgs,
  FunctionReference,
} from "convex/server";
import { Effect } from "effect";

type DeleteStaleMutation = FunctionReference<
  "mutation",
  "internal" | "public",
  DefaultFunctionArgs,
  { deleted: number }
>;

type DeleteStaleArticleArgs = FunctionArgs<
  typeof internal.contentSync.mutations.articles.deleteStaleArticles
>;
type DeleteStaleCurriculumTopicArgs = FunctionArgs<
  typeof internal.contentSync.mutations.curriculum.deleteStaleCurriculumTopics
>;
type DeleteStaleCurriculumLessonArgs = FunctionArgs<
  typeof internal.contentSync.mutations.curriculum.deleteStaleCurriculumLessons
>;

const buildDeleteStaleArticleArgs = (
  items: readonly (StaleItem & {
    id: DeleteStaleArticleArgs["articleIds"][number];
  })[]
): DeleteStaleArticleArgs => ({
  articleIds: items.map((item) => item.id),
});

const buildDeleteStaleCurriculumTopicArgs = (
  items: readonly (StaleItem & {
    id: DeleteStaleCurriculumTopicArgs["topicIds"][number];
  })[]
): DeleteStaleCurriculumTopicArgs => ({
  topicIds: items.map((item) => item.id),
});

const buildDeleteStaleCurriculumLessonArgs = (
  items: readonly (StaleItem & {
    id: DeleteStaleCurriculumLessonArgs["sectionIds"][number];
  })[]
): DeleteStaleCurriculumLessonArgs => ({
  sectionIds: items.map((item) => item.id),
});

const deleteStaleItems = Effect.fn("sync.deleteStaleItems")(function* <
  Item extends StaleItem,
  TFunction extends DeleteStaleMutation,
>(
  config: ConvexConfig,
  mutation: TFunction,
  buildArgs: (items: readonly Item[]) => FunctionArgs<TFunction>,
  items: readonly Item[],
  successLabel: string,
  batchSize: number
) {
  if (items.length === 0) {
    return 0;
  }

  let deleted = 0;
  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    const result = yield* callConvexMutation(
      config,
      mutation,
      buildArgs(batch),
      DeleteResultSchema
    );
    deleted += result.deleted;
  }

  logSuccess(`Deleted ${deleted} ${successLabel}`);
  return deleted;
});

const cleanUnusedAuthors = Effect.fn("sync.cleanUnusedAuthors")(function* (
  config: ConvexConfig,
  options: SyncOptions
) {
  log("\n--- UNUSED AUTHORS ---\n");
  log("Unused authors = authors with no linked content\n");

  const authorsResult = yield* getUnusedAuthors(config);

  if (authorsResult.unusedAuthors.length === 0) {
    logSuccess("No unused authors found!");
    return;
  }

  log(`Found ${authorsResult.unusedAuthors.length} unused authors:\n`);
  for (const author of authorsResult.unusedAuthors.slice(0, 10)) {
    log(`  - ${author.name} (@${author.username})`);
  }
  if (authorsResult.unusedAuthors.length > 10) {
    log(`  ... and ${authorsResult.unusedAuthors.length - 10} more`);
  }

  if (!options.force) {
    log("\nTo delete unused authors, rerun clean with --force --authors.");
    return;
  }

  const authorIds = authorsResult.unusedAuthors.map((author) => author.id);
  let deleted = 0;

  for (
    let index = 0;
    index < authorIds.length;
    index += BATCH_SIZES.unusedAuthors
  ) {
    const batch = authorIds.slice(index, index + BATCH_SIZES.unusedAuthors);
    const result = yield* callConvexMutation(
      config,
      internal.contentSync.mutations.authors.deleteUnusedAuthors,
      { authorIds: batch },
      DeleteResultSchema
    );
    deleted += result.deleted;
  }

  logSuccess(`Deleted ${deleted} unused authors`);
});

/** Removes Nakafa-owned database rows whose source content no longer exists. */
export const clean = Effect.fn("sync.clean")(function* (
  config: ConvexConfig,
  options: SyncOptions
) {
  log("=== CLEAN STALE CONTENT ===\n");
  log("Stale content = exists in database but source file was deleted\n");

  if (!options.force) {
    log("DRY RUN MODE (use --force to actually delete)\n");
  }

  log("Scanning filesystem...");
  const source = yield* collectFilesystemArticleCurriculumSlugs();
  log(`  Articles on disk: ${source.articleSlugs.length}`);
  log(`  Curriculum topics on disk: ${source.curriculumTopicSlugs.length}`);
  log(`  Curriculum lessons on disk: ${source.curriculumLessonSlugs.length}`);

  log("\nQuerying database for stale content...");
  const stale = yield* getStaleArticleCurriculumContent(config, source);
  const totalStale =
    stale.staleArticles.length +
    stale.staleCurriculumTopics.length +
    stale.staleCurriculumLessons.length;
  let deleted = 0;

  if (totalStale === 0) {
    logSuccess("No stale content found!");
  } else {
    log(`\nFound ${totalStale} stale items:\n`);
    logStaleItems("Stale articles", stale.staleArticles);
    logStaleItems("\nStale curriculum topics", stale.staleCurriculumTopics);
    logStaleItems("\nStale curriculum lessons", stale.staleCurriculumLessons);

    if (options.force) {
      log("\nDeleting stale content...");
      deleted += yield* deleteStaleItems(
        config,
        internal.contentSync.mutations.articles.deleteStaleArticles,
        buildDeleteStaleArticleArgs,
        stale.staleArticles,
        "stale articles",
        BATCH_SIZES.staleArticles
      );
      deleted += yield* deleteStaleItems(
        config,
        internal.contentSync.mutations.curriculum.deleteStaleCurriculumTopics,
        buildDeleteStaleCurriculumTopicArgs,
        stale.staleCurriculumTopics,
        "stale curriculum topics and lessons",
        BATCH_SIZES.staleCurriculumTopics
      );
      deleted += yield* deleteStaleItems(
        config,
        internal.contentSync.mutations.curriculum.deleteStaleCurriculumLessons,
        buildDeleteStaleCurriculumLessonArgs,
        stale.staleCurriculumLessons,
        "stale curriculum lessons",
        BATCH_SIZES.staleCurriculumLessons
      );
    } else {
      log("\nRerun clean with --force to delete these rows.");
    }
  }

  if (options.authors) {
    yield* cleanUnusedAuthors(config, options);
  }

  log("\n=== CLEAN COMPLETE ===");
  return { deleted, hasStale: totalStale > 0 };
});
