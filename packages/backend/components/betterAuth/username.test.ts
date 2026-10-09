import { describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { Effect, Schema } from "effect";

const NOW = 1_760_000_000_000;
/** The stored fields this migration is about. A key that a row does not hold stays absent. */
const StoredUsers = Schema.Array(
  Schema.Struct({
    displayUsername: Schema.optionalKey(Schema.NullOr(Schema.String)),
    email: Schema.String,
    username: Schema.optionalKey(Schema.NullOr(Schema.String)),
  })
);

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
        expect(Schema.decodeUnknownSync(StoredUsers)(users.page)).toEqual([
          {
            displayUsername: "Ada",
            email: "named@example.com",
            username: "ada",
          },
          { email: "empty@example.com" },
          { email: "half@example.com" },
          { email: "plain@example.com" },
        ]);
      })
  );
});
