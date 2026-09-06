import { describe, expect, it } from "@effect/vitest";
import {
  createUsernameExists,
  GeneratedUsernameLookupError,
  resolveUniqueGeneratedUsername,
} from "@repo/backend/convex/auth/username/availability";
import {
  createGoogleUsernameFields,
  usernameOptions,
} from "@repo/backend/convex/auth/username/policy";
import { memoryAdapter } from "better-auth/adapters/memory";
import { Effect } from "effect";

describe("auth/username availability", () => {
  it.effect("keeps the generated username when it is already unique", () =>
    Effect.gen(function* () {
      const fields = createGoogleUsernameFields({
        email: "student@gmail.com",
        sub: "109876543210123456789",
      });

      const username = yield* resolveUniqueGeneratedUsername({
        displayUsername: fields.displayUsername,
        email: "student@gmail.com",
        username: fields.username,
        usernameExists: () => Effect.succeed(false),
      });

      expect(username).toBe(fields.username);
    })
  );

  it.effect(
    "creates another generated username when the first one already exists",
    () =>
      Effect.gen(function* () {
        const fields = createGoogleUsernameFields({
          email: "student@gmail.com",
          sub: "109876543210123456789",
        });
        const existingUsernames = new Set([fields.username]);

        const username = yield* resolveUniqueGeneratedUsername({
          displayUsername: fields.displayUsername,
          email: "student@gmail.com",
          username: fields.username,
          usernameExists: (candidate) =>
            Effect.succeed(existingUsernames.has(candidate)),
        });

        expect(username).not.toBe(fields.username);
        expect(username).toBe("g_student_2b1wqpuhiugtj_1");
        expect(usernameOptions.usernameValidator(username)).toBe(true);
        expect(username.length).toBeLessThanOrEqual(
          usernameOptions.maxUsernameLength
        );
      })
  );

  it.effect("keeps trying generated usernames until it finds a free one", () =>
    Effect.gen(function* () {
      const fields = createGoogleUsernameFields({
        email: "student@gmail.com",
        sub: "109876543210123456789",
      });
      const existingUsernames = new Set([
        fields.username,
        "g_student_2b1wqpuhiugtj_1",
      ]);

      const username = yield* resolveUniqueGeneratedUsername({
        displayUsername: fields.displayUsername,
        email: "student@gmail.com",
        username: fields.username,
        usernameExists: (candidate) =>
          Effect.succeed(existingUsernames.has(candidate)),
      });

      expect(username).toBe("g_student_2b1wr3vlfoiu2_2");
    })
  );

  it.effect("fails after the bounded collision candidates are exhausted", () =>
    Effect.gen(function* () {
      const usernameExists = vi.fn(() => Effect.succeed(true));
      const error = yield* Effect.flip(
        resolveUniqueGeneratedUsername({
          displayUsername: "Student",
          email: "student@example.com",
          username: "g_student",
          usernameExists,
        })
      );

      expect(error).toMatchObject({
        _tag: "GeneratedUsernameExhaustedError",
        username: "g_student",
      });
      expect(usernameExists).toHaveBeenCalledTimes(33);
    })
  );

  it.effect("preserves lookup failures without trying another candidate", () =>
    Effect.gen(function* () {
      const failure = new GeneratedUsernameLookupError({
        cause: "adapter unavailable",
        message: "Username lookup failed",
        username: "g_student",
      });
      const usernameExists = vi.fn(() => Effect.fail(failure));
      const error = yield* Effect.flip(
        resolveUniqueGeneratedUsername({
          displayUsername: "Student",
          email: "student@example.com",
          username: "g_student",
          usernameExists,
        })
      );

      expect(error).toBe(failure);
      expect(usernameExists).toHaveBeenCalledTimes(1);
    })
  );

  it.effect.each([
    { exists: false, row: null },
    { exists: true, row: { username: "g_student" } },
  ])("reads username presence as $exists from the adapter", ({ exists, row }) =>
    Effect.gen(function* () {
      const adapter = memoryAdapter({ user: [] })({});
      const findOne = vi.spyOn(adapter, "findOne").mockResolvedValue(row);

      expect(yield* createUsernameExists(adapter)("g_student")).toBe(exists);
      expect(findOne).toHaveBeenCalledExactlyOnceWith({
        model: "user",
        select: ["username"],
        where: [{ field: "username", value: "g_student" }],
      });
    })
  );

  it.effect.each([
    { cause: "database offline", thrown: new Error("database offline") },
    { cause: undefined, thrown: { reason: "connection closed" } },
    { cause: undefined, thrown: "connection closed" },
  ])(
    "converts adapter rejection $thrown to a typed lookup error",
    ({ cause, thrown }) =>
      Effect.gen(function* () {
        const adapter = memoryAdapter({ user: [] })({});
        vi.spyOn(adapter, "findOne").mockRejectedValue(thrown);
        const error = yield* Effect.flip(
          createUsernameExists(adapter)("g_student")
        );

        expect(error).toBeInstanceOf(GeneratedUsernameLookupError);
        expect(error).toMatchObject({
          cause,
          message: "Unable to check generated username availability",
          username: "g_student",
        });
      })
  );
});
