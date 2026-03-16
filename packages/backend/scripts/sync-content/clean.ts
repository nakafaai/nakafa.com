import {
  parseExerciseMaterialFile,
  parseSubjectMaterialFile,
} from "../lib/mdx-parser/materials";
import {
  parseArticlePath,
  parseExercisePath,
  parseSubjectPath,
} from "../lib/mdx-parser/paths";
import {
  runConvexMutationGeneric,
  runConvexQuery,
  runConvexQueryWithArgs,
} from "./convexApi";
import { log, logStaleItems, logSuccess } from "./logging";
import { globFiles } from "./runtime";
import {
  BATCH_SIZES,
  DeleteResultSchema,
  LOCALE_MATERIAL_FILE_REGEX,
  LOCALE_SUBJECT_MATERIAL_FILE_REGEX,
  parseLocale,
  StaleContentSchema,
  UnusedAuthorsSchema,
} from "./schemas";
import type {
  ConvexConfig,
  FilesystemSlugs,
  StaleItem,
  SyncOptions,
} from "./types";

const deleteStaleItems = async (
  config: ConvexConfig,
  mutationPath: string,
  paramName: string,
  items: StaleItem[],
  successLabel: string,
  batchSize = items.length
): Promise<boolean> => {
  if (items.length === 0) {
    return false;
  }

  let deleted = 0;
  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    const ids = batch.map((item) => item.id);
    const result = await runConvexMutationGeneric(
      config,
      mutationPath,
      { [paramName]: ids },
      DeleteResultSchema
    );
    deleted += result.deleted;
  }

  logSuccess(`Deleted ${deleted} ${successLabel}`);
  return true;
};

const collectFilesystemSlugs = async (): Promise<FilesystemSlugs> => {
  const [
    articleFiles,
    subjectFiles,
    subjectMaterialFiles,
    exerciseMaterialFiles,
    questionFiles,
  ] = await Promise.all([
    globFiles("articles/**/*.mdx"),
    globFiles("subject/**/*.mdx"),
    globFiles("subject/**/_data/*-material.ts"),
    globFiles("exercises/**/_data/*-material.ts"),
    globFiles("exercises/**/_question/*.mdx"),
  ]);

  const articleSlugs = articleFiles.map((file) => parseArticlePath(file).slug);
  const subjectSectionSlugs = subjectFiles.map(
    (file) => parseSubjectPath(file).slug
  );
  const exerciseQuestionSlugs = questionFiles.map(
    (file) => parseExercisePath(file).slug
  );

  const subjectTopicSlugs: string[] = [];
  for (const materialFile of subjectMaterialFiles) {
    const localeMatch = materialFile.match(LOCALE_SUBJECT_MATERIAL_FILE_REGEX);
    if (!localeMatch) {
      continue;
    }
    try {
      const topics = await parseSubjectMaterialFile(
        materialFile,
        parseLocale(localeMatch[1], materialFile)
      );
      subjectTopicSlugs.push(...topics.map((topic) => topic.slug));
    } catch {
      // Ignore material files that fail to parse during stale detection.
    }
  }

  const exerciseSetSlugs: string[] = [];
  for (const materialFile of exerciseMaterialFiles) {
    const localeMatch = materialFile.match(LOCALE_MATERIAL_FILE_REGEX);
    if (!localeMatch) {
      continue;
    }
    try {
      const sets = await parseExerciseMaterialFile(
        materialFile,
        parseLocale(localeMatch[1], materialFile)
      );
      exerciseSetSlugs.push(...sets.map((set) => set.slug));
    } catch {
      // Ignore material files that fail to parse during stale detection.
    }
  }

  return {
    articleSlugs,
    subjectTopicSlugs,
    subjectSectionSlugs,
    exerciseSetSlugs,
    exerciseQuestionSlugs,
  };
};

const cleanUnusedAuthors = async (
  config: ConvexConfig,
  options: SyncOptions
): Promise<void> => {
  log("\n--- UNUSED AUTHORS ---\n");
  log("Unused authors = authors with no linked content\n");

  const authorsResult = await runConvexQuery(
    config,
    "contentSync/queries:findUnusedAuthors",
    UnusedAuthorsSchema
  );

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
    const result = await runConvexMutationGeneric(
      config,
      "contentSync/mutations:deleteUnusedAuthors",
      { authorIds },
      DeleteResultSchema
    );
    logSuccess(`Deleted ${result.deleted} unused authors`);
    return;
  }

  log("\nTo delete unused authors, run:");
  if (options.prod) {
    log("  pnpm --filter backend sync:prod:clean --force --authors");
  } else {
    log("  pnpm --filter backend sync:clean --force --authors");
  }
};

export const clean = async (
  config: ConvexConfig,
  options: SyncOptions
): Promise<{ deleted: boolean; hasStale: boolean }> => {
  log("=== CLEAN STALE CONTENT ===\n");
  log("Stale content = exists in database but source file was deleted\n");

  if (!options.force) {
    log("DRY RUN MODE (use --force to actually delete)\n");
  }

  log("Scanning filesystem...");
  const slugs = await collectFilesystemSlugs();
  log(`  Articles on disk: ${slugs.articleSlugs.length}`);
  log(`  Subject topics on disk: ${slugs.subjectTopicSlugs.length}`);
  log(`  Subject sections on disk: ${slugs.subjectSectionSlugs.length}`);
  log(`  Exercise sets on disk: ${slugs.exerciseSetSlugs.length}`);
  log(`  Exercise questions on disk: ${slugs.exerciseQuestionSlugs.length}`);

  log("\nQuerying database for stale content...");
  const stale = await runConvexQueryWithArgs(
    config,
    "contentSync/queries:findStaleContent",
    {
      articleSlugs: slugs.articleSlugs,
      subjectTopicSlugs: slugs.subjectTopicSlugs,
      subjectSectionSlugs: slugs.subjectSectionSlugs,
      exerciseSetSlugs: slugs.exerciseSetSlugs,
      exerciseQuestionSlugs: slugs.exerciseQuestionSlugs,
    },
    StaleContentSchema
  );

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

      await deleteStaleItems(
        config,
        "contentSync/mutations:deleteStaleArticles",
        "articleIds",
        stale.staleArticles,
        "stale articles"
      );
      await deleteStaleItems(
        config,
        "contentSync/mutations:deleteStaleSubjectTopics",
        "topicIds",
        stale.staleSubjectTopics,
        "stale subject topics (and their sections)"
      );
      await deleteStaleItems(
        config,
        "contentSync/mutations:deleteStaleSubjectSections",
        "sectionIds",
        stale.staleSubjectSections,
        "stale subject sections"
      );
      await deleteStaleItems(
        config,
        "contentSync/mutations:deleteStaleExerciseQuestions",
        "questionIds",
        stale.staleExerciseQuestions,
        "stale exercise questions",
        BATCH_SIZES.staleExerciseQuestions
      );
      await deleteStaleItems(
        config,
        "contentSync/mutations:deleteStaleExerciseSets",
        "setIds",
        stale.staleExerciseSets,
        "stale exercise sets",
        BATCH_SIZES.staleExerciseSets
      );
    } else if (options.prod) {
      log("\nTo delete stale content, run:");
      log("  pnpm --filter backend sync:prod:clean --force");
    } else {
      log("\nTo delete stale content, run:");
      log("  pnpm --filter backend sync:clean --force");
    }
  }

  if (options.authors) {
    await cleanUnusedAuthors(config, options);
  }

  log("\n=== CLEAN COMPLETE ===");
  return { hasStale, deleted };
};
