import { parseAndRun } from "./cli";
import { logError } from "./logging";
import { loadEnvFile } from "./runtime";

export const runCli = (): void => {
  loadEnvFile();

  parseAndRun().catch((error: unknown) => {
    logError(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
};
