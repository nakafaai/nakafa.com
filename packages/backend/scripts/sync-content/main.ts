import { parseAndRun } from "@repo/backend/scripts/sync-content/cli";
import { logError } from "@repo/backend/scripts/sync-content/logging";
import { loadEnvFile } from "@repo/backend/scripts/sync-content/runtime";

export const runCli = (): void => {
  loadEnvFile();

  parseAndRun().catch((error: unknown) => {
    logError(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
};
