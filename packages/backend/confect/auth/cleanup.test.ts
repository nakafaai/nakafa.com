import {
  DatabaseReader,
  DatabaseWriter,
  RegisteredConvexFunction,
} from "@confect/server";
import { createThread } from "@convex-dev/agent";
import { describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { drainDeletedUserDataProgram } from "@repo/backend/confect/auth/cleanup";
import { cleanupDeletedUserProgram } from "@repo/backend/confect/auth/cleanup/impl";
import { createDeletedUserTombstone } from "@repo/backend/confect/auth/deletion/tombstone";
import {
  createConvexTestWithBetterAuth,
  seedAnalyticsConsent,
} from "@repo/backend/confect/test.helpers";
import { internal } from "@repo/backend/convex/_generated/api";
import { MASCOT_CODE } from "@repo/backend/test/mascot";
import { Effect, Layer } from "effect";

const NOW = Date.UTC(2026, 6, 22, 8, 0, 0);
const deletedAuthIdPattern = /^deleted:/;
const deletedEmailPattern = /^deleted-.+@account\.nakafa\.invalid$/;
describe("auth/cleanup", () => {
  it.effect(
    "drains every committed local cleanup batch outside the workflow journal",
    () =>
      Effect.gen(function* () {
        const cleanupBatch = vi
          .fn<() => Effect.Effect<boolean>>()
          .mockReturnValueOnce(Effect.succeed(true))
          .mockReturnValueOnce(Effect.succeed(true))
          .mockReturnValueOnce(Effect.succeed(false));
        yield* drainDeletedUserDataProgram(Effect.suspend(cleanupBatch));
        expect(cleanupBatch).toHaveBeenCalledTimes(3);
      })
  );
  it.effect("stops after the first cleanup batch that makes progress", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      const state = yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          const userId = await ctx.db.insert("users", {
            authId: "bounded-cleanup-user",
            credits: 10,
            creditsResetAt: NOW,
            email: "bounded@example.com",
            mascot: MASCOT_CODE,
            name: "Bounded User",
            plan: "free",
          });
          await ctx.db.patch(
            "users",
            userId,
            createDeletedUserTombstone(userId, NOW)
          );
          const otherUserId = await ctx.db.insert("users", {
            authId: "bounded-cleanup-reader",
            credits: 10,
            creditsResetAt: NOW,
            email: "reader@example.com",
            mascot: MASCOT_CODE,
            name: "Reader",
            plan: "free",
          });
          const commentId = await ctx.db.insert("comments", {
            slug: "material/algebra",
            userId,
            text: "Deleted personal comment",
            replyCount: 1,
          });
          const replyId = await ctx.db.insert("comments", {
            slug: "material/algebra",
            userId: otherUserId,
            text: "Reply by another user",
            parentId: commentId,
            replyToUserId: userId,
            replyCount: 0,
          });
          return {
            commentId,
            replyId,
            userId,
          };
        })
      );
      const hasMore = yield* Effect.promise(() =>
        t.mutation(internal.auth.cleanup.cleanupDeletedUser, {
          userId: state.userId,
        })
      );
      const remaining = yield* Effect.promise(() =>
        t.query(async (ctx) => ({
          comment: await ctx.db.get("comments", state.commentId),
          reply: await ctx.db.get("comments", state.replyId),
          user: await ctx.db.get("users", state.userId),
        }))
      );
      expect(hasMore).toBe(true);
      expect(remaining.reply?.replyToUserId).toBeUndefined();
      expect(remaining.comment).not.toBeNull();
      expect(remaining.user).toMatchObject({
        authId: expect.stringMatching(deletedAuthIdPattern),
        email: expect.stringMatching(deletedEmailPattern),
      });
    })
  );
  it.effect(
    "deletes personal data and anonymizes the shared-record identity",
    () =>
      Effect.gen(function* () {
        const runtimeServices = yield* Effect.context<never>();
        const t = createConvexTestWithBetterAuth();
        const result = yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            const userId = await ctx.db.insert("users", {
              authId: "deleted-auth-user",
              credits: 10,
              creditsResetAt: NOW,
              email: "deleted@example.com",
              mascot: MASCOT_CODE,
              name: "Deleted User",
              plan: "free",
            });
            await ctx.db.patch(
              "users",
              userId,
              createDeletedUserTombstone(userId, NOW)
            );
            const otherUserId = await ctx.db.insert("users", {
              authId: "retained-auth-user",
              credits: 10,
              creditsResetAt: NOW,
              email: "retained@example.com",
              mascot: MASCOT_CODE,
              name: "Retained User",
              plan: "free",
            });
            await seedAnalyticsConsent(ctx, {
              decidedAt: NOW,
              userId,
            });
            await ctx.db.insert("chats", {
              threadId: await createThread(ctx, components.nina, { userId }),
              type: "study",
              updatedAt: NOW,
              userId,
              visibility: "private",
            });
            await ctx.db.insert("creditTransactions", {
              amount: -1,
              balanceAfter: 9,
              type: "usage",
              userId,
            });
            await ctx.db.insert("learningPreferences", {
              preferredCurriculumProgramKey: "indonesia-kurikulum-merdeka",
              updatedAt: NOW,
              userId,
            });
            const deletedCommentId = await ctx.db.insert("comments", {
              slug: "material/algebra",
              userId,
              text: "Deleted personal comment",
              replyCount: 1,
            });
            const referencedCommentId = await ctx.db.insert("comments", {
              slug: "material/algebra",
              userId: otherUserId,
              text: "Reply without retained personal preview",
              parentId: deletedCommentId,
              replyToUserId: userId,
              replyCount: 0,
            });
            let hasMore = true;
            while (hasMore) {
              hasMore = await Effect.runPromiseWith(runtimeServices)(
                cleanupDeletedUserProgram(userId).pipe(
                  Effect.provide(
                    Layer.provideMerge(
                      Layer.mergeAll(
                        DatabaseReader.layer(databaseSchema, ctx.db),
                        DatabaseWriter.layer(databaseSchema, ctx.db)
                      ),
                      RegisteredConvexFunction.mutationLayer(
                        databaseSchema,
                        ctx
                      )
                    )
                  )
                )
              );
            }
            return {
              consentDecisions: await ctx.db
                .query("accountConsentDecisions")
                .withIndex("by_userId_and_category_and_decidedAt", (query) =>
                  query.eq("userId", userId)
                )
                .take(2),
              consents: await ctx.db
                .query("accountConsents")
                .withIndex("by_userId_and_category", (query) =>
                  query.eq("userId", userId)
                )
                .take(2),
              chats: await ctx.db
                .query("chats")
                .withIndex("by_userId", (query) => query.eq("userId", userId))
                .collect(),
              creditTransactions: await ctx.db
                .query("creditTransactions")
                .withIndex("by_userId", (query) => query.eq("userId", userId))
                .collect(),
              learningPreferences: await ctx.db
                .query("learningPreferences")
                .withIndex("by_userId", (query) => query.eq("userId", userId))
                .collect(),
              referencedComment: await ctx.db.get(
                "comments",
                referencedCommentId
              ),
              user: await ctx.db.get("users", userId),
            };
          })
        );
        expect(result).toEqual({
          chats: [],
          consentDecisions: [],
          consents: [],
          creditTransactions: [],
          learningPreferences: [],
          referencedComment: expect.objectContaining({
            text: "Reply without retained personal preview",
          }),
          user: expect.objectContaining({
            authId: expect.stringMatching(deletedAuthIdPattern),
            credits: 0,
            creditsResetAt: 0,
            deletedAt: expect.any(Number),
            email: expect.stringMatching(deletedEmailPattern),
            name: "Deleted user",
            plan: "free",
          }),
        });
        expect(result.user).not.toHaveProperty("image");
        expect(result.user).not.toHaveProperty("role");
        expect(result.referencedComment).not.toHaveProperty("parentId");
        expect(result.referencedComment).not.toHaveProperty("replyToUserId");
      })
  );
  it("deletes a deleted learner's personal connections, their sealed tokens, and their journal entries, and keeps another learner's", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const seedUser = (name: string) =>
        ctx.db.insert("users", {
          authId: `connections-${name}`,
          credits: 10,
          creditsResetAt: NOW,
          email: `connections-${name}@example.com`,
          mascot: MASCOT_CODE,
          name,
          plan: "free",
        });
      const seedConnection = async (
        userId: Awaited<ReturnType<typeof seedUser>>,
        withToken: boolean
      ) => {
        const connectionId = await ctx.db.insert("connectorConnections", {
          connector: "drive",
          googleAccountKey: null,
          lastSyncedAt: null,
          nextSyncAt: null,
          owner: { kind: "personal", userId },
          scopes: ["drive.file"],
          status: "active",
        });
        if (withToken) {
          await ctx.db.insert("connectorSecrets", {
            connectionId,
            refreshToken: new ArrayBuffer(61),
          });
        }
        await ctx.db.insert("journalEntries", {
          actor: { id: userId, kind: "user" },
          change: {
            connection: connectionId,
            connector: "drive",
            type: "connection.connected",
          },
          owner: { kind: "personal", userId },
          subject: { id: connectionId, kind: "connection" },
        });
        return connectionId;
      };
      const deleted = await seedUser("deleted");
      await ctx.db.patch(
        "users",
        deleted,
        createDeletedUserTombstone(deleted, NOW)
      );
      await seedConnection(deleted, true);
      await seedConnection(deleted, false);
      const retained = await seedUser("retained");
      return {
        deleted,
        retained,
        retainedConnection: await seedConnection(retained, true),
      };
    });
    let hasMore = true;
    while (hasMore) {
      hasMore = await t.mutation(internal.auth.cleanup.cleanupDeletedUser, {
        userId: seeded.deleted,
      });
    }
    const remaining = await t.query(async (ctx) => ({
      connections: await ctx.db.query("connectorConnections").collect(),
      journal: await ctx.db.query("journalEntries").collect(),
      secrets: await ctx.db.query("connectorSecrets").collect(),
    }));
    expect(remaining.connections).toEqual([
      expect.objectContaining({
        _id: seeded.retainedConnection,
        owner: { kind: "personal", userId: seeded.retained },
      }),
    ]);
    expect(remaining.secrets).toEqual([
      expect.objectContaining({ connectionId: seeded.retainedConnection }),
    ]);
    expect(remaining.journal).toEqual([
      expect.objectContaining({
        owner: { kind: "personal", userId: seeded.retained },
      }),
    ]);
  });
});
