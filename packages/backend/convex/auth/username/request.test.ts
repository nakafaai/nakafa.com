import { rejectReservedUsername } from "@repo/backend/convex/auth/username/request";
import { describe, expect, it } from "@repo/testing/effect";
import { Effect, Exit } from "effect";

describe("auth/username request", () => {
  it.live("rejects user-provided usernames from the generated namespace", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        rejectReservedUsername({ username: "g_student_ng64hohj4t2h3" })
      );

      expect(Exit.isFailure(exit)).toBe(true);
    })
  );

  it.live(
    "allows user-provided usernames outside the generated namespace",
    () =>
      Effect.gen(function* () {
        expect(
          yield* rejectReservedUsername({ username: "student" })
        ).toBeUndefined();
      })
  );
});
