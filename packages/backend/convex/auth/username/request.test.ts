import { describe, expect, it } from "@effect/vitest";
import { rejectReservedUsername } from "@repo/backend/convex/auth/username/request";
import { Effect, Exit } from "effect";

describe("auth/username request", () => {
  it.effect(
    "rejects user-provided usernames from the generated namespace",
    () =>
      Effect.gen(function* () {
        const exit = yield* Effect.exit(
          rejectReservedUsername({ username: "g_student_ng64hohj4t2h3" })
        );

        expect(Exit.isFailure(exit)).toBe(true);
      })
  );

  it.effect(
    "allows user-provided usernames outside the generated namespace",
    () =>
      Effect.gen(function* () {
        expect(
          yield* rejectReservedUsername({ username: "student" })
        ).toBeUndefined();
      })
  );
});
