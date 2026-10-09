import { describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { Array as Arr, Effect } from "effect";

const NOW = 1_760_000_000_000;

describe("Better Auth retired username fields", () => {
  it.effect(
    "removes empty username fields, keeps a stored username, and reports both",
    () =>
      Effect.gen(function* () {
        const test = createConvexTestWithBetterAuth();
        const create = (email: string, fields: Record<string, string | null>) =>
          Effect.promise(() =>
            test.mutation(components.betterAuth.adapter.create, {
              input: {
                model: "user",
                data: {
                  createdAt: NOW,
                  email,
                  emailVerified: true,
                  name: email,
                  updatedAt: NOW,
                  ...fields,
                },
              },
            })
          );
        yield* create("named@example.com", {
          displayUsername: "Ada",
          username: "ada",
        });
        yield* create("empty@example.com", {
          displayUsername: null,
          username: null,
        });
        yield* create("half@example.com", { username: null });
        yield* create("plain@example.com", {});

        const first = yield* Effect.promise(() =>
          test.mutation(
            components.betterAuth.username.clearEmptyUsernameFields,
            { cursor: null }
          )
        );
        expect(first).toMatchObject({
          cleared: 2,
          isDone: true,
          scanned: 4,
          text: 1,
        });

        const second = yield* Effect.promise(() =>
          test.mutation(
            components.betterAuth.username.clearEmptyUsernameFields,
            { cursor: null }
          )
        );
        expect(second).toMatchObject({ cleared: 0, scanned: 4, text: 1 });

        const users = yield* Effect.promise(() =>
          test.query(components.betterAuth.adapter.findMany, {
            model: "user",
            paginationOpts: { cursor: null, numItems: 10 },
          })
        );
        expect(
          Arr.map(users.page, (user: Record<string, unknown>) => [
            user.email,
            "username" in user,
            "displayUsername" in user,
            user.username,
          ])
        ).toEqual([
          ["named@example.com", true, true, "ada"],
          ["empty@example.com", false, false, undefined],
          ["half@example.com", false, false, undefined],
          ["plain@example.com", false, false, undefined],
        ]);
      })
  );
});
