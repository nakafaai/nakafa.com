import { describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { Effect, Schema } from "effect";

const NOW = 1_760_000_000_000;
/** The stored fields this migration removes. A key that a row does not hold stays absent. */
const StoredUsers = Schema.Array(
  Schema.Struct({
    displayUsername: Schema.optionalKey(Schema.NullOr(Schema.String)),
    email: Schema.String,
    username: Schema.optionalKey(Schema.NullOr(Schema.String)),
  })
);

describe("Better Auth retired username fields", () => {
  it.effect(
    "removes both fields from every user that holds one and leaves the rest of the row",
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
        yield* create("half@example.com", { username: "half" });
        yield* create("plain@example.com", {});

        const first = yield* Effect.promise(() =>
          test.mutation(components.betterAuth.username.clearUsernameFields, {
            cursor: null,
          })
        );
        expect(first).toMatchObject({ cleared: 3, isDone: true, scanned: 4 });

        const second = yield* Effect.promise(() =>
          test.mutation(components.betterAuth.username.clearUsernameFields, {
            cursor: null,
          })
        );
        expect(second).toMatchObject({ cleared: 0, isDone: true, scanned: 4 });

        const users = yield* Effect.promise(() =>
          test.query(components.betterAuth.adapter.findMany, {
            model: "user",
            paginationOpts: { cursor: null, numItems: 10 },
          })
        );
        const stored = yield* Schema.decodeUnknownEffect(StoredUsers)(
          users.page
        );
        expect(stored).toEqual([
          { email: "named@example.com" },
          { email: "empty@example.com" },
          { email: "half@example.com" },
          { email: "plain@example.com" },
        ]);
      })
  );
});
