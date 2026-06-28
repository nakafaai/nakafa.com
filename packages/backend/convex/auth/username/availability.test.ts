import { resolveUniqueGeneratedUsername } from "@repo/backend/convex/auth/username/availability";
import {
  createGoogleUsernameFields,
  usernameOptions,
} from "@repo/backend/convex/auth/username/policy";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

describe("auth/username availability", () => {
  it("keeps the generated username when it is already unique", async () => {
    const fields = createGoogleUsernameFields({
      email: "student@gmail.com",
      sub: "109876543210123456789",
    });

    const username = await Effect.runPromise(
      resolveUniqueGeneratedUsername({
        displayUsername: fields.displayUsername,
        email: "student@gmail.com",
        username: fields.username,
        usernameExists: () => Effect.succeed(false),
      })
    );

    expect(username).toBe(fields.username);
  });

  it("creates another generated username when the first one already exists", async () => {
    const fields = createGoogleUsernameFields({
      email: "student@gmail.com",
      sub: "109876543210123456789",
    });
    const existingUsernames = new Set([fields.username]);

    const username = await Effect.runPromise(
      resolveUniqueGeneratedUsername({
        displayUsername: fields.displayUsername,
        email: "student@gmail.com",
        username: fields.username,
        usernameExists: (candidate) =>
          Effect.succeed(existingUsernames.has(candidate)),
      })
    );

    expect(username).not.toBe(fields.username);
    expect(username).toBe("g_student_2b1wqpuhiugtj_1");
    expect(usernameOptions.usernameValidator(username)).toBe(true);
    expect(username.length).toBeLessThanOrEqual(
      usernameOptions.maxUsernameLength
    );
  });

  it("keeps trying generated usernames until it finds a free one", async () => {
    const fields = createGoogleUsernameFields({
      email: "student@gmail.com",
      sub: "109876543210123456789",
    });
    const existingUsernames = new Set([
      fields.username,
      "g_student_2b1wqpuhiugtj_1",
    ]);

    const username = await Effect.runPromise(
      resolveUniqueGeneratedUsername({
        displayUsername: fields.displayUsername,
        email: "student@gmail.com",
        username: fields.username,
        usernameExists: (candidate) =>
          Effect.succeed(existingUsernames.has(candidate)),
      })
    );

    expect(username).toBe("g_student_2b1wr3vlfoiu2_2");
  });
});
