import { internal } from "@repo/backend/convex/_generated/api";
import {
  parseArticlePath,
  parseExercisePath,
  parseSubjectPath,
} from "@repo/backend/scripts/lib/mdx-parser/paths";
import { callConvexMutation } from "@repo/backend/scripts/sync-content/convex";
import {
  getStaleContent,
  getUnusedAuthors,
} from "@repo/backend/scripts/sync-content/inspection";
import {
  log,
  logStaleItems,
  logSuccess,
} from "@repo/backend/scripts/sync-content/logging";
import { globFiles } from "@repo/backend/scripts/sync-content/runtime";
import {
  BATCH_SIZES,
  DeleteResultSchema,
} from "@repo/backend/scripts/sync-content/schemas";
import type {
  ConvexConfig,
  StaleItem,
  SyncOptions,
} from "@repo/backend/scripts/sync-content/types";
import {
  listExerciseSets,
  listSubjectTopics,
} from "@repo/contents/_types/material/registry";
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
type DeleteStaleSubjectTopicArgs = FunctionArgs<
  typeof internal.contentSync.mutations.subjects.deleteStaleSubjectTopics
>;
type DeleteStaleSubjectSectionArgs = FunctionArgs<
  typeof internal.contentSync.mutations.subjects.deleteStaleSubjectSections
>;
type DeleteStaleExerciseQuestionArgs = FunctionArgs<
  typeof internal.contentSync.mutations.exercises.deleteStaleExerciseQuestions
>;
type DeleteStaleExerciseSetArgs = FunctionArgs<
  typeof internal.contentSync.mutations.exercises.deleteStaleExerciseSets
>;

/** Builds mutation args for deleting stale article rows. */
const buildDeleteStaleArticleArgs = (
  items: readonly (StaleItem & {
    id: DeleteStaleArticleArgs["articleIds"][number];
  })[]
): DeleteStaleArticleArgs => ({
  articleIds: items.map((item) => item.id),
});

/** Builds mutation args for deleting stale subject topic rows. */
const buildDeleteStaleSubjectTopicArgs = (
  items: readonly (StaleItem & {
    id: DeleteStaleSubjectTopicArgs["topicIds"][number];
  })[]
): DeleteStaleSubjectTopicArgs => ({
  topicIds: items.map((item) => item.id),
});

/** Builds mutation args for deleting stale subject section rows. */
const buildDeleteStaleSubjectSectionArgs = (
  items: readonly (StaleItem & {
    id: DeleteStaleSubjectSectionArgs["sectionIds"][number];
  })[]
): DeleteStaleSubjectSectionArgs => ({
  sectionIds: items.map((item) => item.id),
});

/** Builds mutation args for deleting stale exercise question rows. */
const buildDeleteStaleExerciseQuestionArgs = (
  items: readonly (StaleItem & {
    id: DeleteStaleExerciseQuestionArgs["questionIds"][number];
  })[]
): DeleteStaleExerciseQuestionArgs => ({
  questionIds: items.map((item) => item.id),
});

/** Builds mutation args for deleting stale exercise set rows. */
const buildDeleteStaleExerciseSetArgs = (
  items: readonly (StaleItem & {
    id: DeleteStaleExerciseSetArgs["setIds"][number];
  })[]
): DeleteStaleExerciseSetArgs => ({
  setIds: items.map((item) => item.id),
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

/** Collects source slugs from the content files that should exist in Convex. */
const collectFilesystemSlugs = Effect.fn("sync.collectFilesystemSlugs")(
  function* () {
    const [articleFiles, subjectFiles, questionFiles] = yield* Effect.all([
      globFiles("articles/**/*.mdx"),
      globFiles("subject/**/*.mdx"),
      globFiles("exercises/**/_question/*.mdx"),
    ]);

    const articleSlugs: string[] = [];
    for (const file of articleFiles) {
      const pathInfo = yield* parseArticlePath(file);
      articleSlugs.push(pathInfo.slug);
    }

    const subjectSectionSlugs: string[] = [];
    for (const file of subjectFiles) {
      const pathInfo = yield* parseSubjectPath(file);
      subjectSectionSlugs.push(pathInfo.slug);
    }

    const exerciseQuestionSlugs: string[] = [];
    for (const file of questionFiles) {
      const pathInfo = yield* parseExercisePath(file);
      exerciseQuestionSlugs.push(pathInfo.slug);
    }

    const subjectTopicSlugs = listSubjectTopics().map((topic) => topic.slug);
    const exerciseSetSlugs = listExerciseSets().map((set) => set.slug);

    return {
      articleSlugs,
      subjectTopicSlugs,
      subjectSectionSlugs,
      exerciseSetSlugs,
      exerciseQuestionSlugs,
    };
  }
);

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
  log(`  Subject topics on disk: ${slugs.subjectTopicSlugs.length}`);
  log(`  Subject sections on disk: ${slugs.subjectSectionSlugs.length}`);
  log(`  Exercise sets on disk: ${slugs.exerciseSetSlugs.length}`);
  log(`  Exercise questions on disk: ${slugs.exerciseQuestionSlugs.length}`);

  log("\nQuerying database for stale content...");
  const stale = yield* getStaleContent(config, slugs);

  const totalStale =
    stale.staleArticles.length +
    stale.staleSubjectTopics.length +
    stale.staleSubjectSections.length +
    stale.staleExerciseSets.length +
    stale.staleExerciseQuestions.length;

  let hasStale = false;
  let deleted = 0;

  if (totalStale === 0) {
    logSuccess("No stale content found!");
  } else {
    hasStale = true;
    log(`\nFound ${totalStale} stale items:\n`);
    logStaleItems("Stale articles", stale.staleArticles);
    logStaleItems("\nStale subject topics", stale.staleSubjectTopics);
    logStaleItems("\nStale subject sections", stale.staleSubjectSections);
    logStaleItems("\nStale exercise sets", stale.staleExerciseSets);
    logStaleItems("\nStale exercise questions", stale.staleExerciseQuestions);

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
        internal.contentSync.mutations.subjects.deleteStaleSubjectTopics,
        buildDeleteStaleSubjectTopicArgs,
        stale.staleSubjectTopics,
        "stale subject topics (and their sections)",
        BATCH_SIZES.staleSubjectTopics
      );
      deleted += yield* deleteStaleItems(
        config,
        internal.contentSync.mutations.subjects.deleteStaleSubjectSections,
        buildDeleteStaleSubjectSectionArgs,
        stale.staleSubjectSections,
        "stale subject sections",
        BATCH_SIZES.staleSubjectSections
      );
      deleted += yield* deleteStaleItems(
        config,
        internal.contentSync.mutations.exercises.deleteStaleExerciseQuestions,
        buildDeleteStaleExerciseQuestionArgs,
        stale.staleExerciseQuestions,
        "stale exercise questions",
        BATCH_SIZES.staleExerciseQuestions
      );
      deleted += yield* deleteStaleItems(
        config,
        internal.contentSync.mutations.exercises.deleteStaleExerciseSets,
        buildDeleteStaleExerciseSetArgs,
        stale.staleExerciseSets,
        "stale exercise sets",
        BATCH_SIZES.staleExerciseSets
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
