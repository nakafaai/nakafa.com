import { fileURLToPath } from "node:url";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { inspectDependencyPolicy } from "#scripts/dependencies/source";

const REPOSITORY_ROOT = fileURLToPath(new URL("../..", import.meta.url));

describe("dependency policy", () => {
  it.effect("accepts the actual repository dependency policy", () =>
    Effect.gen(function* () {
      const problems = yield* inspectDependencyPolicy(REPOSITORY_ROOT).pipe(
        Effect.provide(NodeServices.layer)
      );
      expect(problems).toEqual([]);
    })
  );
});
