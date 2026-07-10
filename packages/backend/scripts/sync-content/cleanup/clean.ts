import { internal } from "@repo/backend/convex/_generated/api";
import { collectFilesystemSlugs } from "@repo/backend/scripts/sync-content/cleanup/source";
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
  getStaleContent,
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
type DeleteStaleQuestionArgs = FunctionArgs<
  typeof internal.contentSync.mutations.tryouts.deleteStaleQuestions
>;
type DeleteStaleQuestionSetArgs = FunctionArgs<
  typeof internal.contentSync.mutations.tryouts.deleteStaleQuestionSets
>;
type DeleteStaleTryoutCountryArgs = FunctionArgs<
  typeof internal.contentSync.mutations.tryouts.deleteStaleTryoutCountries
>;
type DeleteStaleTryoutExamArgs = FunctionArgs<
  typeof internal.contentSync.mutations.tryouts.deleteStaleTryoutExams
>;
type DeleteStaleTryoutTrackArgs = FunctionArgs<
  typeof internal.contentSync.mutations.tryouts.deleteStaleTryoutTracks
>;
type DeleteStaleTryoutSetArgs = FunctionArgs<
  typeof internal.contentSync.mutations.tryouts.deleteStaleTryoutSets
>;
type DeleteStaleTryoutSectionArgs = FunctionArgs<
  typeof internal.contentSync.mutations.tryouts.deleteStaleTryoutSections
>;

/** Builds mutation args for deleting stale article rows. */
const buildDeleteStaleArticleArgs = (
  items: readonly (StaleItem & {
    id: DeleteStaleArticleArgs["articleIds"][number];
  })[]
): DeleteStaleArticleArgs => ({
  articleIds: items.map((item) => item.id),
});

/** Builds mutation args for deleting stale curriculum topic rows. */
const buildDeleteStaleCurriculumTopicArgs = (
  items: readonly (StaleItem & {
    id: DeleteStaleCurriculumTopicArgs["topicIds"][number];
  })[]
): DeleteStaleCurriculumTopicArgs => ({
  topicIds: items.map((item) => item.id),
});

/** Builds mutation args for deleting stale curriculum lesson rows. */
const buildDeleteStaleCurriculumLessonArgs = (
  items: readonly (StaleItem & {
    id: DeleteStaleCurriculumLessonArgs["sectionIds"][number];
  })[]
): DeleteStaleCurriculumLessonArgs => ({
  sectionIds: items.map((item) => item.id),
});

/** Builds mutation args for deleting stale question rows. */
const buildDeleteStaleQuestionArgs = (
  items: readonly (StaleItem & {
    id: DeleteStaleQuestionArgs["questionIds"][number];
  })[]
): DeleteStaleQuestionArgs => ({
  questionIds: items.map((item) => item.id),
});

/** Builds mutation args for deleting stale question-set rows. */
const buildDeleteStaleQuestionSetArgs = (
  items: readonly (StaleItem & {
    id: DeleteStaleQuestionSetArgs["questionSetIds"][number];
  })[]
): DeleteStaleQuestionSetArgs => ({
  questionSetIds: items.map((item) => item.id),
});

/** Builds mutation args for deleting stale try-out country rows. */
const buildDeleteStaleTryoutCountryArgs = (
  items: readonly (StaleItem & {
    id: DeleteStaleTryoutCountryArgs["countryIds"][number];
  })[]
): DeleteStaleTryoutCountryArgs => ({
  countryIds: items.map((item) => item.id),
});

/** Builds mutation args for deleting stale try-out exam rows. */
const buildDeleteStaleTryoutExamArgs = (
  items: readonly (StaleItem & {
    id: DeleteStaleTryoutExamArgs["examIds"][number];
  })[]
): DeleteStaleTryoutExamArgs => ({
  examIds: items.map((item) => item.id),
});

/** Builds mutation args for deleting stale try-out track rows. */
const buildDeleteStaleTryoutTrackArgs = (
  items: readonly (StaleItem & {
    id: DeleteStaleTryoutTrackArgs["trackIds"][number];
  })[]
): DeleteStaleTryoutTrackArgs => ({
  trackIds: items.map((item) => item.id),
});

/** Builds mutation args for deleting stale try-out set rows. */
const buildDeleteStaleTryoutSetArgs = (
  items: readonly (StaleItem & {
    id: DeleteStaleTryoutSetArgs["setIds"][number];
  })[]
): DeleteStaleTryoutSetArgs => ({
  setIds: items.map((item) => item.id),
});

/** Builds mutation args for deleting stale try-out section rows. */
const buildDeleteStaleTryoutSectionArgs = (
  items: readonly (StaleItem & {
    id: DeleteStaleTryoutSectionArgs["sectionIds"][number];
  })[]
): DeleteStaleTryoutSectionArgs => ({
  sectionIds: items.map((item) => item.id),
});

/** Deletes stale rows through one generated bounded delete mutation. */
const deleteStaleItems = Effect.fn("sync.deleteStaleItems")(function* <
  Item extends StaleItem,
  TFunction extends DeleteStaleMutation,
>(
  config: ConvexConfig,
  mutation: TFunction,
  buildArgs: (items: readonly Item[]) => FunctionArgs<TFunction>,
  items: readonly Item[],
  successLabel: string,
  batchSize = items.length
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

/** Deletes authors that no longer have content links when clean is forced. */
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

  if (options.force) {
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
    return;
  }

  log("\nTo delete unused authors, run:");
  if (options.prod) {
    log("  pnpm --filter @repo/backend sync:prod:clean --force --authors");
  } else {
    log("  pnpm --filter @repo/backend sync:clean --force --authors");
  }
});

/** Removes database rows whose source content no longer exists. */
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
  const slugs = yield* collectFilesystemSlugs();
  log(`  Articles on disk: ${slugs.articleSlugs.length}`);
  log(`  Curriculum topics on disk: ${slugs.curriculumTopicSlugs.length}`);
  log(`  Curriculum lessons on disk: ${slugs.curriculumLessonSlugs.length}`);
  log(`  Question sets on disk: ${slugs.questionSetSourcePaths.length}`);
  log(`  Questions on disk: ${slugs.questionSourcePaths.length}`);
  log(`  Try-out countries on disk: ${slugs.tryoutCountryPaths.length}`);
  log(`  Try-out exams on disk: ${slugs.tryoutExamPaths.length}`);
  log(`  Try-out tracks on disk: ${slugs.tryoutTrackPaths.length}`);
  log(`  Try-out sets on disk: ${slugs.tryoutSetPaths.length}`);
  log(`  Try-out sections on disk: ${slugs.tryoutSectionPaths.length}`);

  log("\nQuerying database for stale content...");
  const stale = yield* getStaleContent(config, slugs);

  const totalStale =
    stale.staleArticles.length +
    stale.staleCurriculumTopics.length +
    stale.staleCurriculumLessons.length +
    stale.staleQuestionSets.length +
    stale.staleQuestions.length +
    stale.staleTryoutCountries.length +
    stale.staleTryoutExams.length +
    stale.staleTryoutTracks.length +
    stale.staleTryoutSets.length +
    stale.staleTryoutSections.length;

  let hasStale = false;
  let deleted = 0;

  if (totalStale === 0) {
    logSuccess("No stale content found!");
  } else {
    hasStale = true;
    log(`\nFound ${totalStale} stale items:\n`);
    logStaleItems("Stale articles", stale.staleArticles);
    logStaleItems("\nStale curriculum topics", stale.staleCurriculumTopics);
    logStaleItems("\nStale curriculum lessons", stale.staleCurriculumLessons);
    logStaleItems("\nStale question sets", stale.staleQuestionSets);
    logStaleItems("\nStale questions", stale.staleQuestions);
    logStaleItems("\nStale try-out countries", stale.staleTryoutCountries);
    logStaleItems("\nStale try-out exams", stale.staleTryoutExams);
    logStaleItems("\nStale try-out tracks", stale.staleTryoutTracks);
    logStaleItems("\nStale try-out sets", stale.staleTryoutSets);
    logStaleItems("\nStale try-out sections", stale.staleTryoutSections);

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
        "stale curriculum topics (and their sections)",
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
      deleted += yield* deleteStaleItems(
        config,
        internal.contentSync.mutations.tryouts.deleteStaleQuestions,
        buildDeleteStaleQuestionArgs,
        stale.staleQuestions,
        "stale questions",
        BATCH_SIZES.staleQuestions
      );
      deleted += yield* deleteStaleItems(
        config,
        internal.contentSync.mutations.tryouts.deleteStaleTryoutSections,
        buildDeleteStaleTryoutSectionArgs,
        stale.staleTryoutSections,
        "stale try-out sections",
        BATCH_SIZES.staleTryoutSections
      );
      deleted += yield* deleteStaleItems(
        config,
        internal.contentSync.mutations.tryouts.deleteStaleQuestionSets,
        buildDeleteStaleQuestionSetArgs,
        stale.staleQuestionSets,
        "stale question sets",
        BATCH_SIZES.staleQuestionSets
      );
      deleted += yield* deleteStaleItems(
        config,
        internal.contentSync.mutations.tryouts.deleteStaleTryoutSets,
        buildDeleteStaleTryoutSetArgs,
        stale.staleTryoutSets,
        "stale try-out sets",
        BATCH_SIZES.staleTryoutSets
      );
      deleted += yield* deleteStaleItems(
        config,
        internal.contentSync.mutations.tryouts.deleteStaleTryoutTracks,
        buildDeleteStaleTryoutTrackArgs,
        stale.staleTryoutTracks,
        "stale try-out tracks",
        BATCH_SIZES.staleTryoutTracks
      );
      deleted += yield* deleteStaleItems(
        config,
        internal.contentSync.mutations.tryouts.deleteStaleTryoutExams,
        buildDeleteStaleTryoutExamArgs,
        stale.staleTryoutExams,
        "stale try-out exams",
        BATCH_SIZES.staleTryoutExams
      );
      deleted += yield* deleteStaleItems(
        config,
        internal.contentSync.mutations.tryouts.deleteStaleTryoutCountries,
        buildDeleteStaleTryoutCountryArgs,
        stale.staleTryoutCountries,
        "stale try-out countries",
        BATCH_SIZES.staleTryoutCountries
      );
    } else if (options.prod) {
      log("\nTo delete stale content, run:");
      log("  pnpm --filter @repo/backend sync:prod:clean --force");
    } else {
      log("\nTo delete stale content, run:");
      log("  pnpm --filter @repo/backend sync:clean --force");
    }
  }

  if (options.authors) {
    yield* cleanUnusedAuthors(config, options);
  }

  log("\n=== CLEAN COMPLETE ===");
  return { hasStale, deleted };
});
