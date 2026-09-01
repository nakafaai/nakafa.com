import { describe, expect, it } from "@effect/vitest";
import { components, internal } from "@repo/backend/convex/_generated/api";
import { ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE } from "@repo/backend/convex/auth/deletion/constants";
import { createDeletedUserTombstone } from "@repo/backend/convex/auth/deletion/tombstone";
import { drainDeletedUserVerificationsProgram } from "@repo/backend/convex/auth/deletion/verification";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { Effect, Schema } from "effect";

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
  it.effect(
    "resumes from the last committed verification page after an action retry",
    () =>
      Effect.gen(function* () {
        let durableCursor: string | null = null;
        let interruptNextPage = true;
        const deletePage = vi.fn((cursor: string | null) => {
          if (cursor === null) {
            return Promise.resolve({
              continueCursor: "verification-cursor-1",
              isDone: false,
            });
          }
          if (interruptNextPage) {
            interruptNextPage = false;
            return Promise.reject(new Error("action interrupted"));
          }
          return Promise.resolve({
            continueCursor: "verification-cursor-2",
            isDone: true,
          });
        });
        const operations = {
          deletePage,
          loadCursor: vi.fn(() => Promise.resolve(durableCursor)),
          saveCursor: vi.fn((cursor: string | null) => {
            durableCursor = cursor;
            return Promise.resolve();
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
        expect(deletePage.mock.calls.map(([cursor]) => cursor)).toEqual([
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
          { length: ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE + 1 },
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
        yield* Effect.promise(() =>
          t.mutation(components.betterAuth.adapter.create, {
            input: {
              model: "verification",
              data: {
                createdAt: NOW + 101,
                expiresAt: NOW + 60_000,
                identifier: "oauth-link-state",
                updatedAt: NOW + 101,
                value: JSON.stringify({
                  callbackURL: "https://nakafa.com/id",
                  codeVerifier: "verifier",
                  expiresAt: NOW + 60_000,
                  link: {
                    email: "verification-owner@example.com",
                    userId: authUser._id,
                  },
                }),
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
        expect(state.remaining.page.map((row) => row.value)).toEqual([
          ...unrelatedValues,
          substringValue,
        ]);
        expect(state.user).not.toHaveProperty("authVerificationCleanupCursor");
      })
  );
});
