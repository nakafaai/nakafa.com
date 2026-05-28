import type { Ref } from "@confect/core";
import refs from "@repo/backend/confect/_generated/refs";
import {
  parseExerciseMaterialFile,
  parseSubjectMaterialFile,
} from "@repo/backend/scripts/lib/mdx-parser/materials";
import {
  parseArticlePath,
  parseExercisePath,
  parseSubjectPath,
} from "@repo/backend/scripts/lib/mdx-parser/paths";
import { callConvex } from "@repo/backend/scripts/sync-content/convex";
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
  LOCALE_MATERIAL_FILE_REGEX,
  LOCALE_SUBJECT_MATERIAL_FILE_REGEX,
  parseLocale,
} from "@repo/backend/scripts/sync-content/schemas";
import type {
  ConvexConfig,
  StaleItem,
  SyncOptions,
} from "@repo/backend/scripts/sync-content/types";
import { Effect } from "effect";

const deleteStaleItems = Effect.fn("sync.deleteStaleItems")(function* (
  config: ConvexConfig,
  mutationRef: Ref.AnyMutation,
  getArgs: (ids: readonly string[]) => Ref.Args<Ref.Any>,
  items: readonly StaleItem[],
  successLabel: string,
  batchSize = items.length
) {
  if (items.length === 0) {
    return false;
  }

  let deleted = 0;
  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    const ids = batch.map((item) => item.id);
    const result = yield* callConvex(
      config,
      "mutation",
      mutationRef,
      getArgs(ids)
    );
    deleted += result.deleted;
  }

  logSuccess(`Deleted ${deleted} ${successLabel}`);
  return true;
});

const collectFilesystemSlugs = Effect.fn("sync.collectFilesystemSlugs")(
  function* () {
    const [
      articleFiles,
      subjectFiles,
      subjectMaterialFiles,
      exerciseMaterialFiles,
      questionFiles,
    ] = yield* Effect.all([
      globFiles("articles/**/*.mdx"),
      globFiles("subject/**/*.mdx"),
      globFiles("subject/**/_data/*-material.ts"),
      globFiles("exercises/**/_data/*-material.ts"),
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

    const subjectTopicSlugs: string[] = [];
    for (const materialFile of subjectMaterialFiles) {
      const localeMatch = materialFile.match(
        LOCALE_SUBJECT_MATERIAL_FILE_REGEX
      );
      if (!localeMatch) {
        continue;
      }
      const locale = yield* parseLocale(localeMatch[1], materialFile);
      const result = yield* Effect.either(
        parseSubjectMaterialFile(materialFile, locale)
      );

      if (result._tag === "Right") {
        const topics = result.right;
        subjectTopicSlugs.push(...topics.map((topic) => topic.slug));
      }
    }

    const exerciseSetSlugs: string[] = [];
    for (const materialFile of exerciseMaterialFiles) {
      const localeMatch = materialFile.match(LOCALE_MATERIAL_FILE_REGEX);
      if (!localeMatch) {
        continue;
      }
      const locale = yield* parseLocale(localeMatch[1], materialFile);
      const result = yield* Effect.either(
        parseExerciseMaterialFile(materialFile, locale)
      );

      if (result._tag === "Right") {
        const sets = result.right;
        exerciseSetSlugs.push(...sets.map((set) => set.slug));
      }
    }

    return {
      articleSlugs,
      subjectTopicSlugs,
      subjectSectionSlugs,
      exerciseSetSlugs,
      exerciseQuestionSlugs,
    };
  }
);

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
      const result = yield* callConvex(
        config,
        "mutation",
        refs.internal.contentSync.mutations.authors.deleteUnusedAuthors,
        { authorIds: batch }
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
  let deleted = false;

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
      deleted = true;
      log("\nDeleting stale content...");

      yield* deleteStaleItems(
        config,
        refs.internal.contentSync.mutations.articles.deleteStaleArticles,
        (articleIds) => ({ articleIds }),
        stale.staleArticles,
        "stale articles",
        BATCH_SIZES.staleArticles
      );
      yield* deleteStaleItems(
        config,
        refs.internal.contentSync.mutations.subjects.deleteStaleSubjectTopics,
        (topicIds) => ({ topicIds }),
        stale.staleSubjectTopics,
        "stale subject topics (and their sections)",
        BATCH_SIZES.staleSubjectTopics
      );
      yield* deleteStaleItems(
        config,
        refs.internal.contentSync.mutations.subjects.deleteStaleSubjectSections,
        (sectionIds) => ({ sectionIds }),
        stale.staleSubjectSections,
        "stale subject sections",
        BATCH_SIZES.staleSubjectSections
      );
      yield* deleteStaleItems(
        config,
        refs.internal.contentSync.mutations.exercises
          .deleteStaleExerciseQuestions,
        (questionIds) => ({ questionIds }),
        stale.staleExerciseQuestions,
        "stale exercise questions",
        BATCH_SIZES.staleExerciseQuestions
      );
      yield* deleteStaleItems(
        config,
        refs.internal.contentSync.mutations.exercises.deleteStaleExerciseSets,
        (setIds) => ({ setIds }),
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
