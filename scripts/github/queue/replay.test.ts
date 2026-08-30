import { describe, expect, it } from "@effect/vitest";
import { Effect, Result } from "effect";
import { validateReleaseReplay } from "#scripts/github/queue/replay";

describe("Changesets release replay", () => {
  it.effect("accepts the exact replayed tree", () =>
    validateReleaseReplay("generated-tree", "generated-tree")
  );

  it.effect("rejects any generated tree difference", () =>
    validateReleaseReplay("generated-tree", "modified-tree").pipe(
      Effect.result,
      Effect.tap((result) =>
        Effect.sync(() => {
          expect(Result.isFailure(result)).toBe(true);
        })
      )
    )
  );
});
