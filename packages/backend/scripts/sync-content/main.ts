import { parseAndRun } from "@repo/backend/scripts/sync-content/cli";
import { logError } from "@repo/backend/scripts/sync-content/logging";
import { loadEnvProvider } from "@repo/backend/scripts/sync-content/runtime";
import { Effect } from "effect";

/** Runs the sync-content CLI with backend env loaded through Effect Config. */
export const runCli = (): void => {
  Effect.runPromise(
    Effect.gen(function* () {
      const provider = yield* loadEnvProvider();
      yield* parseAndRun().pipe(Effect.withConfigProvider(provider));
    })
  ).catch((error: unknown) => {
    logError(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
};
