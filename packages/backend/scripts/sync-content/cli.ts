import { ScriptFailureError } from "@repo/backend/scripts/lib/errors";
import { syncArticles } from "@repo/backend/scripts/sync-content/articles";
import { syncAuthors } from "@repo/backend/scripts/sync-content/authors";
import { invalidateContentRuntimeCache } from "@repo/backend/scripts/sync-content/cache";
import { clean } from "@repo/backend/scripts/sync-content/clean";
import { getConvexConfig } from "@repo/backend/scripts/sync-content/convex";
import {
  syncCurriculumLessons,
  syncCurriculumTopics,
} from "@repo/backend/scripts/sync-content/curriculum";
import {
  syncExerciseQuestions,
  syncExerciseSets,
} from "@repo/backend/scripts/sync-content/exercises";
import { syncLearningPrograms } from "@repo/backend/scripts/sync-content/learningPrograms";
import { log, logError } from "@repo/backend/scripts/sync-content/logging";
import { syncGeneratedReadModels } from "@repo/backend/scripts/sync-content/readModels";
import { reset } from "@repo/backend/scripts/sync-content/reset";
import { resetAnalytics } from "@repo/backend/scripts/sync-content/resetAnalytics";
import { resetAudio } from "@repo/backend/scripts/sync-content/resetAudio";
import { resetTryouts } from "@repo/backend/scripts/sync-content/resetTryouts";
import type { SyncOptions } from "@repo/backend/scripts/sync-content/types";
import { validate } from "@repo/backend/scripts/sync-content/validate";
import { verify } from "@repo/backend/scripts/sync-content/verify";
import {
  syncAll,
  syncFull,
  syncIncremental,
} from "@repo/backend/scripts/sync-content/workflows";
import { Effect } from "effect";

/** Parses one sync-content CLI invocation into a command and option bag. */
const parseArgs = Effect.fn("sync.parseArgs")(function* () {
  const args = yield* Effect.sync(() => process.argv.slice(2));
  const type = args[0] || "all";
  const options: SyncOptions = {};

  for (let index = 1; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--locale" && args[index + 1]) {
      const locale = args[index + 1];
      if (locale === "en" || locale === "id") {
        options.locale = locale;
        index++;
      }
    }
    if (arg === "--force") {
      options.force = true;
    }
    if (arg === "--authors") {
      options.authors = true;
    }
    if (arg === "--sequential") {
      options.sequential = true;
    }
    if (arg === "--incremental") {
      options.incremental = true;
    }
    if (arg === "--prod") {
      options.prod = true;
    }
  }

  return { type, options };
});

/** Prints the supported sync-content commands and flags. */
const printUsage = (): void => {
  log("\nUsage: pnpm --filter @repo/backend sync[:<command>] [options]");
  log("\nCommands:");
  log("  sync                  - Full sync + clean + verify (recommended)");
  log(
    "  sync:incremental      - Sync only changed files (fast, for daily use)"
  );
  log("  sync:validate         - Validate content without syncing (for CI)");
  log("  sync:verify           - Verify database matches filesystem");
  log(
    "  learning-programs     - Sync program catalog and graph-backed coverage"
  );
  log(
    "  read-models           - Sync generated material/curriculum/assessment read models"
  );
  log("  sync:clean            - Find and remove stale content");
  log(
    "  sync:reset            - Delete synced content/runtime rows (authors optional, requires --force)"
  );
  log(
    "  sync:reset:analytics  - Delete content view, popularity, trending, and analytics queue rows"
  );
  log(
    "  sync:reset:audio      - Delete audio source, generated audio, and audio queue rows"
  );
  log(
    "  sync:reset:tryouts    - Delete tryout content/read models, access rows, entitlements, and IRT scale data, then run a full sync"
  );
  log("\nProduction commands:");
  log("  sync:prod             - Full sync to production");
  log("  sync:prod:incremental - Incremental sync to production");
  log("  sync:prod:verify      - Verify production database");
  log("  sync:prod:clean       - Clean stale content in production");
  log(
    "  sync:prod:reset       - Delete synced content/runtime rows in production (authors optional)"
  );
  log(
    "  sync:prod:reset:analytics - Delete content analytics rows in production"
  );
  log("  sync:prod:reset:audio - Delete audio read models in production");
  log(
    "  sync:prod:reset:tryouts - Delete tryout content/read models, access rows, entitlements, and IRT scale data in production, then run a full sync"
  );
  log("\nOptions:");
  log("  --locale en|id  - Sync specific locale only");
  log("  --force         - Actually delete content (for clean/reset)");
  log("  --authors       - Also delete authors (for clean/reset)");
  log("  --sequential    - Run sync phases sequentially (for debugging)");
  log("  --prod          - Target production database");
  log("\nExamples:");
  log("  pnpm --filter @repo/backend sync                 # Full sync to dev");
  log("  pnpm --filter @repo/backend sync:incremental     # Fast daily sync");
  log("  pnpm --filter @repo/backend sync:prod            # Full sync to prod");
  log(
    "  pnpm --filter @repo/backend sync:reset --force   # Delete all content"
  );
};

/** Dispatches one parsed sync-content command to the matching workflow. */
export const runCommand = Effect.fn("sync.runCommand")(function* (
  type: string,
  options: SyncOptions
) {
  if (type === "validate") {
    yield* validate();
    return;
  }

  const config = yield* getConvexConfig(options);

  switch (type) {
    case "articles":
      yield* syncAuthors(config, options);
      yield* syncArticles(config, options);
      return;
    case "subjects":
      yield* syncAuthors(config, options);
      yield* syncCurriculumTopics(config, options);
      yield* syncCurriculumLessons(config, options);
      yield* syncGeneratedReadModels(config, options);
      return;
    case "curriculum-topics":
      yield* syncAuthors(config, options);
      yield* syncCurriculumTopics(config, options);
      yield* syncGeneratedReadModels(config, options);
      return;
    case "curriculum-lessons":
      yield* syncAuthors(config, options);
      yield* syncCurriculumLessons(config, options);
      yield* syncGeneratedReadModels(config, options);
      return;
    case "exercise-sets":
      yield* syncAuthors(config, options);
      yield* syncExerciseSets(config, options);
      yield* syncGeneratedReadModels(config, options);
      return;
    case "exercise-questions":
      yield* syncAuthors(config, options);
      yield* syncExerciseQuestions(config, options);
      yield* syncGeneratedReadModels(config, options);
      return;
    case "exercises":
      yield* syncAuthors(config, options);
      yield* syncExerciseSets(config, options);
      yield* syncExerciseQuestions(config, options);
      yield* syncGeneratedReadModels(config, options);
      return;
    case "read-models":
      yield* syncGeneratedReadModels(config, options);
      return;
    case "learning-programs":
      yield* syncLearningPrograms(config, options);
      yield* invalidateContentRuntimeCache(options);
      return;
    case "all":
      yield* syncAll(config, options);
      return;
    case "incremental":
      yield* syncIncremental(config, options);
      return;
    case "verify":
      yield* verify(config, options);
      return;
    case "clean":
      yield* clean(config, options);
      return;
    case "full":
      yield* syncFull(config, options);
      return;
    case "reset":
      yield* reset(config, options);
      return;
    case "reset-analytics":
      yield* resetAnalytics(config, options);
      return;
    case "reset-audio":
      yield* resetAudio(config, options);
      return;
    case "reset-tryouts":
      yield* resetTryouts(config, options);
      return;
    default:
      logError(`Unknown command: ${type}`);
      printUsage();
      return yield* Effect.fail(
        new ScriptFailureError({ message: `Unknown command: ${type}` })
      );
  }
});

/** Parses process arguments and runs the selected sync-content workflow. */
export const parseAndRun = Effect.fn("sync.parseAndRun")(function* () {
  const { type, options } = yield* parseArgs();
  yield* runCommand(type, options);
});
