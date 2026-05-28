import { describe, expect, it } from "@effect/vitest";
import {
  assertContentSyncBatchSize,
  slugify,
} from "@repo/backend/confect/modules/content/contentSync.shared";
import { Cause, Effect, Exit, Option } from "effect";

describe("content sync shared helpers", () => {
  it.effect("allows batches within the configured limit", () =>
    Effect.gen(function* () {
      const result = yield* assertContentSyncBatchSize({
        functionName: "sync",
        limit: 2,
        received: 2,
        unit: "rows",
      });

      expect(result).toBeNull();
    })
  );

  it.effect("fails batches that exceed the configured limit", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        assertContentSyncBatchSize({
          functionName: "sync",
          limit: 2,
          received: 3,
          unit: "rows",
        })
      );

      expect(Exit.isFailure(exit)).toBe(true);

      if (Exit.isSuccess(exit)) {
        return;
      }

      const error = Cause.failureOption(exit.cause);

      expect(Option.isSome(error)).toBe(true);
      expect(Option.getOrThrow(error)).toMatchObject({
        _tag: "ContentSyncError",
        message: "sync received 3 rows, which exceeds the safe limit of 2.",
      });
    })
  );

  it.effect("normalizes display text to sync slugs", () =>
    Effect.sync(() => {
      expect(slugify("  TKA: Bahasa Indonesia -- 2026!  ")).toBe(
        "tka-bahasa-indonesia-2026"
      );
    })
  );
});
