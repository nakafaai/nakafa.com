import { syncArticles } from "./articles";
import { syncAuthors } from "./authors";
import { clean } from "./clean";
import { getConvexConfig } from "./convexApi";
import { syncExerciseQuestions, syncExerciseSets } from "./exercises";
import { log, logError } from "./logging";
import { reset } from "./reset";
import { resetTryouts } from "./resetTryouts";
import { syncSubjectSections, syncSubjectTopics } from "./subjects";
import type { SyncOptions } from "./types";
import { validate } from "./validate";
import { verify } from "./verify";
import { syncAll, syncFull, syncIncremental } from "./workflows";

/** Parses one sync-content CLI invocation into a command and option bag. */
const parseArgs = (): { options: SyncOptions; type: string } => {
  const args = process.argv.slice(2);
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
};

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
  log("  sync:clean            - Find and remove stale content");
  log("  sync:reset            - Delete ALL synced content (requires --force)");
  log(
    "  sync:reset:tryouts    - Delete tryout content/read models, access rows, entitlements, and IRT scale data, then run a full sync"
  );
  log("\nProduction commands:");
  log("  sync:prod             - Full sync to production");
  log("  sync:prod:incremental - Incremental sync to production");
  log("  sync:prod:verify      - Verify production database");
  log("  sync:prod:clean       - Clean stale content in production");
  log("  sync:prod:reset       - Delete ALL content in production");
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
export const runCommand = async (
  type: string,
  options: SyncOptions
): Promise<void> => {
  if (type === "validate") {
    await validate();
    return;
  }

  const config = getConvexConfig(options);

  switch (type) {
    case "articles":
      await syncAuthors(config, options);
      await syncArticles(config, options);
      return;
    case "subjects":
      await syncAuthors(config, options);
      await syncSubjectTopics(config, options);
      await syncSubjectSections(config, options);
      return;
    case "subject-topics":
      await syncAuthors(config, options);
      await syncSubjectTopics(config, options);
      return;
    case "subject-sections":
      await syncAuthors(config, options);
      await syncSubjectSections(config, options);
      return;
    case "exercise-sets":
      await syncAuthors(config, options);
      await syncExerciseSets(config, options);
      return;
    case "exercise-questions":
      await syncAuthors(config, options);
      await syncExerciseQuestions(config, options);
      return;
    case "exercises":
      await syncAuthors(config, options);
      await syncExerciseSets(config, options);
      await syncExerciseQuestions(config, options);
      return;
    case "all":
      await syncAll(config, options);
      return;
    case "incremental":
      await syncIncremental(config, options);
      return;
    case "verify":
      await verify(config, options);
      return;
    case "clean":
      await clean(config, options);
      return;
    case "full":
      await syncFull(config, options);
      return;
    case "reset":
      await reset(config, options);
      return;
    case "reset-tryouts":
      await resetTryouts(config, options);
      return;
    default:
      logError(`Unknown command: ${type}`);
      printUsage();
      process.exit(1);
  }
};

/** Parses process arguments and runs the selected sync-content workflow. */
export const parseAndRun = async (): Promise<void> => {
  const { type, options } = parseArgs();
  await runCommand(type, options);
};
