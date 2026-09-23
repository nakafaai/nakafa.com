import { describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/convex/_generated/api";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { Effect } from "effect";

describe("Better Auth component write boundaries", () => {
  it.effect(
    "rejects malformed component user IDs before linking or updating a user",
    () =>
      Effect.gen(function* () {
        const test = createConvexTestWithBetterAuth();
        const mutations = [
          () =>
            test.mutation((ctx) =>
              ctx.runMutation(components.betterAuth.mutations.setUserId, {
                authId: "invalid",
                userId: "app-user",
              })
            ),
          () =>
            test.mutation((ctx) =>
              ctx.runMutation(components.betterAuth.mutations.updateUserName, {
                authId: "invalid",
                name: "New name",
              })
            ),
        ];
        for (const mutation of mutations) {
          yield* Effect.promise(() =>
            expect(mutation()).rejects.toMatchObject({
              data: {
                code: "BETTER_AUTH_USER_ID_INVALID",
                message: "Better Auth user ID is invalid.",
              },
            })
          );
        }
      })
  );
});
