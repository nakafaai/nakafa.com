import { describe, expect, it } from "@effect/vitest";
import {
  DatabaseWriter,
  MutationCtx,
} from "@repo/backend/confect/_generated/services";
import { createDeletedUserTombstone } from "@repo/backend/confect/auth/deletion/tombstone";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { getAppUserByUsername } from "@repo/backend/confect/users/directory";
import { Effect } from "effect";

const NOW = Date.UTC(2026, 9, 12, 12, 0, 0);

describe("auth/deletion/tombstone", () => {
  it.effect(
    "leaves no username and no bio on the deleted account, which frees the username",
    () =>
      Effect.gen(function* () {
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            const ctx = yield* MutationCtx;
            const writer = yield* DatabaseWriter;
            const userId = yield* Effect.promise(() =>
              ctx.db.insert("users", {
                authId: "auth-leaving",
                bio: "Belajar fisika.",
                credits: 100,
                creditsResetAt: 0,
                email: "leaving@example.com",
                image: "https://example.com/leaving.png",
                name: "Leaving",
                plan: "free",
                username: "leaving_one",
              })
            );
            expect(yield* getAppUserByUsername("leaving_one")).not.toBeNull();

            // The deletion applies the tombstone through the same decoded patch.
            yield* writer
              .table("users")
              .patch(userId, createDeletedUserTombstone(userId, NOW))
              .pipe(Effect.orDie);

            expect(yield* getAppUserByUsername("leaving_one")).toBeNull();
            const user = yield* Effect.promise(() =>
              ctx.db.get("users", userId)
            );
            expect(user).toMatchObject({
              deletedAt: NOW,
              name: "Deleted user",
            });
            expect(user).not.toHaveProperty("username");
            expect(user).not.toHaveProperty("bio");
            expect(user).not.toHaveProperty("image");
          })
        );
      })
  );
});
