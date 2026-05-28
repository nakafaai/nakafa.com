import { GenericId } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import { assertEquals } from "@effect/vitest/utils";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import * as TestConfect from "@repo/backend/test/testConfect";
import { Effect, Schema } from "effect";

const resetAt = 0;

const userIdSchema = GenericId.GenericId("users");

/** Inserts a synced app user through the Confect database writer service. */
const seedUser = Effect.fn("identityTest.seedUser")(function* () {
  const writer = yield* DatabaseWriter;

  return yield* writer.table("users").insert({
    authId: "auth-user-1",
    credits: 10,
    creditsResetAt: resetAt,
    email: "user@example.com",
    image: "https://example.com/avatar.png",
    name: "Confect User",
    plan: "free",
    role: "student",
  });
});

describe("identity Confect functions", () => {
  it.effect("reads the current user through TestConfect identity", () =>
    Effect.gen(function* () {
      const confect = yield* TestConfect.TestConfect;
      const userId = yield* confect.run(seedUser(), userIdSchema);

      const currentUser = yield* confect
        .withIdentity({
          subject: "auth-user-1",
          tokenIdentifier: "https://nakafa.test|auth-user-1",
        })
        .query(refs.public.auth.getCurrentUser, {});

      assertEquals(currentUser?.appUser._id, userId);
      assertEquals(currentUser?.authUser.email, "user@example.com");
      assertEquals(currentUser?.authUser.name, "Confect User");
    }).pipe(Effect.provide(TestConfect.layer()))
  );

  it.effect("decodes public user profile responses from generated refs", () =>
    Effect.gen(function* () {
      const confect = yield* TestConfect.TestConfect;
      const userId = yield* confect.run(seedUser(), userIdSchema);

      const publicUser = yield* confect.query(refs.public.auth.getUserById, {
        userId,
      });

      expect(publicUser).toStrictEqual({
        image: "https://example.com/avatar.png",
        name: "Confect User",
      });
    }).pipe(Effect.provide(TestConfect.layer()))
  );

  it.effect("serves Confect HTTP endpoints through TestConfect fetch", () =>
    Effect.gen(function* () {
      const confect = yield* TestConfect.TestConfect;
      const response = yield* confect.fetch("/v1/");
      const body = yield* Effect.promise(() => response.json());
      const metadata = yield* Schema.decodeUnknown(
        Schema.Struct({
          docs: Schema.Literal("https://docs.nakafa.com/api"),
          status: Schema.Literal("active"),
          version: Schema.Literal("1.0.0"),
        })
      )(body);

      assertEquals(response.status, 200);
      assertEquals(metadata.status, "active");
    }).pipe(Effect.provide(TestConfect.layer()))
  );
});
