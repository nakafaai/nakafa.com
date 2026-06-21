import { formatScriptCause } from "@repo/backend/scripts/lib/errors";
import { parseAndRun } from "@repo/backend/scripts/sync-content/cli/command";
import { logError } from "@repo/backend/scripts/sync-content/cli/logging";
import { loadEnvProvider } from "@repo/backend/scripts/sync-content/runtime/files";
import { Effect } from "effect";

/** Runs the sync-content CLI with backend env loaded through Effect Config. */
export const runCli = (): void => {
  Effect.runPromise(
    Effect.gen(function* () {
      const provider = yield* loadEnvProvider();
      yield* parseAndRun().pipe(Effect.withConfigProvider(provider));
    }).pipe(
      Effect.catchAllCause((cause) =>
        Effect.sync(() => {
          logError(formatScriptCause(cause));
          process.exitCode = 1;
        })
      )
    )
  );
};
