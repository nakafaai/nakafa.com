import { fileURLToPath } from "node:url";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Result } from "effect";
import {
  inspectGithubQueuePolicy,
  validateGithubQueuePolicy,
} from "./queue.ts";

const REPOSITORY_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const WORKFLOW_PATH = `${REPOSITORY_ROOT}/.github/workflows/agent-docs.yml`;

describe("GitHub merge queue", () => {
  it.effect("keeps signed admission on one exact parsed contract", () =>
    Effect.gen(function* () {
      expect(
        yield* inspectGithubQueuePolicy(REPOSITORY_ROOT).pipe(
          Effect.provide(NodeServices.layer)
        )
      ).toEqual([]);
    })
  );

  it.effect("rejects unreviewed jobs and bypassed acceptance commands", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const source = yield* fileSystem.readFileString(WORKFLOW_PATH);
      const extraJob = source.replace(
        "jobs:\n",
        "jobs:\n  bypass:\n    runs-on: ubuntu-latest\n    steps: []\n"
      );
      const bypassedRequired = source.replace(
        'if [ "$PRODUCTION_SCOPE_RESULT" != "success" ]; then',
        "if false; then"
      );
      const bypassedQuality = source.replace("run: pnpm test", 'run: "true"');
      const bypassedProduction = source.replace(
        "run: pnpm build",
        'run: "true"'
      );
      const [jobResult, requiredResult, qualityResult, productionResult] =
        yield* Effect.all([
          validateGithubQueuePolicy(extraJob).pipe(Effect.result),
          validateGithubQueuePolicy(bypassedRequired).pipe(Effect.result),
          validateGithubQueuePolicy(bypassedQuality).pipe(Effect.result),
          validateGithubQueuePolicy(bypassedProduction).pipe(Effect.result),
        ]);

      expect(Result.isFailure(jobResult)).toBe(true);
      expect(Result.isFailure(requiredResult)).toBe(true);
      expect(Result.isFailure(qualityResult)).toBe(true);
      expect(Result.isFailure(productionResult)).toBe(true);
    }).pipe(Effect.provide(NodeServices.layer))
  );
});
