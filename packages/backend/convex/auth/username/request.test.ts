import { rejectReservedUsername } from "@repo/backend/convex/auth/username/request";
import { Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";

describe("auth/username request", () => {
  it("rejects user-provided usernames from the generated namespace", async () => {
    const exit = await Effect.runPromiseExit(
      rejectReservedUsername({ username: "g_student_ng64hohj4t2h3" })
    );

    expect(Exit.isFailure(exit)).toBe(true);
  });

  it("allows user-provided usernames outside the generated namespace", async () => {
    await expect(
      Effect.runPromise(rejectReservedUsername({ username: "student" }))
    ).resolves.toBeUndefined();
  });
});
