import { describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import { toUserCleanupError } from "@repo/backend/confect/auth/cleanup/spec";
import { ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE } from "@repo/backend/confect/auth/deletion/constants";
import { createDeletedUserTombstone } from "@repo/backend/confect/auth/deletion/tombstone";
import { drainDeletedUserVerificationsProgram } from "@repo/backend/confect/auth/deletion/verification";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { internal } from "@repo/backend/convex/_generated/api";
import { JsonTextSchema } from "@repo/utilities/json";
import { Array as Arr, Effect, Schema } from "effect";

const NOW = Date.UTC(2026, 6, 28, 21, 0, 0);
const decodeVerificationPage = Schema.decodeUnknownSync(
  Schema.Struct({
    page: Schema.Array(
      Schema.Struct({
        value: Schema.String,
      })
    ),
  })
);
describe("auth/deletion/verification", () => {
  it("keeps cleanup cursors off active or already removed users", async () => {
    const t = createConvexTestWithBetterAuth();
    const { userId } = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW, suffix: "verification-cursor" })
    );
    const refs = internal.auth.deletion.verification;
    await t.mutation(refs.saveDeletedUserVerificationCursor, {
      userId,
      cursor: "ignored",
    });
    expect(
      await t.query(refs.loadDeletedUserVerificationCursor, { userId })
    ).toBeNull();
    await t.mutation((ctx) => ctx.db.delete(userId));
    await t.mutation(refs.saveDeletedUserVerificationCursor, {
      userId,
      cursor: "stale",
    });
    expect(
      await t.query(refs.loadDeletedUserVerificationCursor, { userId })
    ).toBeNull();
  });
  it.effect(
    "resumes from the last committed verification page after an action retry",
    () =>
      Effect.gen(function* () {
        let durableCursor: string | null = null;
        let interruptNextPage = true;
        const deletePage = vi.fn((cursor: string | null) => {
          if (cursor === null) {
            return Effect.succeed({
              continueCursor: "verification-cursor-1",
              isDone: false,
            });
          }
          if (interruptNextPage) {
            interruptNextPage = false;
            return Effect.fail(
              toUserCleanupError(new Error("action interrupted"))
            );
          }
          return Effect.succeed({
            continueCursor: "verification-cursor-2",
            isDone: true,
          });
        });
        const operations = {
          deletePage,
          loadCursor: Effect.sync(() => durableCursor),
          saveCursor: vi.fn((cursor: string | null) => {
            durableCursor = cursor;
            return Effect.void;
          }),
        };
        const interrupted = yield* drainDeletedUserVerificationsProgram(
          operations
        ).pipe(Effect.result);
        expect(interrupted).toMatchObject({
          _tag: "Failure",
          failure: {
            _tag: "UserCleanupError",
          },
        });
        expect(durableCursor).toBe("verification-cursor-1");
        expect(
          yield* drainDeletedUserVerificationsProgram(operations)
        ).toBeUndefined();
        expect(Arr.map(deletePage.mock.calls, ([cursor]) => cursor)).toEqual([
          null,
          "verification-cursor-1",
          "verification-cursor-1",
        ]);
        expect(durableCursor).toBeNull();
      })
  );
  it.effect(
    "drains direct tokens and OAuth-link state across bounded pages",
    () =>
      Effect.gen(function* () {
        const t = createConvexTestWithBetterAuth();
        const authUser = yield* Effect.promise(() =>
          t.mutation(components.betterAuth.adapter.create, {
            input: {
              model: "user",
              data: {
                createdAt: NOW,
                email: "verification-owner@example.com",
                emailVerified: true,
                name: "Verification owner",
                updatedAt: NOW,
              },
            },
            select: ["_id"],
          })
        );
        const unrelatedValues = Array.from(
          {
            length: ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE + 1,
          },
          (_, index) => `unrelated-${index}`
        );
        for (const [index, value] of unrelatedValues.entries()) {
          yield* Effect.promise(() =>
            t.mutation(components.betterAuth.adapter.create, {
              input: {
                model: "verification",
                data: {
                  createdAt: NOW + index,
                  expiresAt: NOW + 60_000,
                  identifier: `unrelated-${index}`,
                  updatedAt: NOW + index,
                  value,
                },
              },
            })
          );
        }
        yield* Effect.promise(() =>
          t.mutation(components.betterAuth.adapter.create, {
            input: {
              model: "verification",
              data: {
                createdAt: NOW + 100,
                expiresAt: NOW + 60_000,
                identifier: "reset-password:token",
                updatedAt: NOW + 100,
                value: authUser._id,
              },
            },
          })
        );
        const oauthLinkState = yield* Schema.encodeEffect(JsonTextSchema)({
          callbackURL: "https://nakafa.com/id",
          codeVerifier: "verifier",
          expiresAt: NOW + 60_000,
          link: {
            email: "verification-owner@example.com",
            userId: authUser._id,
          },
        }).pipe(Effect.orDie);
        yield* Effect.promise(() =>
          t.mutation(components.betterAuth.adapter.create, {
            input: {
              model: "verification",
              data: {
                createdAt: NOW + 101,
                expiresAt: NOW + 60_000,
                identifier: "oauth-link-state",
                updatedAt: NOW + 101,
                value: oauthLinkState,
              },
            },
          })
        );
        const substringValue = `unrelated-${authUser._id}`;
        yield* Effect.promise(() =>
          t.mutation(components.betterAuth.adapter.create, {
            input: {
              model: "verification",
              data: {
                createdAt: NOW + 102,
                expiresAt: NOW + 60_000,
                identifier: "unrelated-substring",
                updatedAt: NOW + 102,
                value: substringValue,
              },
            },
          })
        );
        const userId = yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            const insertedUserId = await ctx.db.insert("users", {
              authId: authUser._id,
              credits: 0,
              creditsResetAt: NOW,
              email: "verification-owner@example.com",
              name: "Verification owner",
              plan: "free",
            });
            await ctx.db.patch(
              "users",
              insertedUserId,
              createDeletedUserTombstone(insertedUserId, NOW)
            );
            return insertedUserId;
          })
        );
        yield* Effect.promise(() =>
          t.action(
            internal.auth.deletion.verification.drainDeletedUserVerifications,
            {
              authId: authUser._id,
              userId,
            }
          )
        );
        const state = yield* Effect.promise(() =>
          t.query(async (ctx) => ({
            remaining: decodeVerificationPage(
              await ctx.runQuery(components.betterAuth.adapter.findMany, {
                model: "verification",
                paginationOpts: {
                  cursor: null,
                  numItems: 100,
                },
                select: ["value"],
              })
            ),
            user: await ctx.db.get("users", userId),
          }))
        );
        expect(Arr.map(state.remaining.page, (row) => row.value)).toEqual([
          ...unrelatedValues,
          substringValue,
        ]);
        expect(state.user).not.toHaveProperty("authVerificationCleanupCursor");
      })
  );
});
