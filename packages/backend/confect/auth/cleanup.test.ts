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
            name: "Reader",
            plan: "free",
          });
          const commentId = await ctx.db.insert("comments", {
            slug: "material/algebra",
            userId,
            text: "Deleted personal comment",
            upvoteCount: 0,
            downvoteCount: 0,
            replyCount: 1,
          });
          const replyId = await ctx.db.insert("comments", {
            slug: "material/algebra",
            userId: otherUserId,
            text: "Reply by another user",
            parentId: commentId,
            replyToUserId: userId,
            replyToText: "Deleted personal comment",
            upvoteCount: 0,
            downvoteCount: 0,
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
              upvoteCount: 0,
              downvoteCount: 0,
              replyCount: 1,
            });
            const referencedCommentId = await ctx.db.insert("comments", {
              slug: "material/algebra",
              userId: otherUserId,
              text: "Reply without retained personal preview",
              parentId: deletedCommentId,
              replyToUserId: userId,
              replyToText: "Deleted personal comment",
              upvoteCount: 0,
              downvoteCount: 0,
              replyCount: 0,
            });
            const schoolId = await ctx.db.insert("schools", {
              name: "Retained School",
              slug: "retained-school",
              email: "school@example.com",
              city: "Jakarta",
              province: "DKI Jakarta",
              type: "high-school",
              currentStudents: 0,
              currentTeachers: 0,
              updatedAt: NOW,
              createdBy: otherUserId,
            });
            const classId = await ctx.db.insert("schoolClasses", {
              schoolId,
              name: "Retained Class",
              subject: "Mathematics",
              year: "2026",
              image: "logic",
              isArchived: false,
              visibility: "private",
              studentCount: 0,
              teacherCount: 1,
              updatedAt: NOW,
              createdBy: otherUserId,
            });
            const forumId = await ctx.db.insert("schoolClassForums", {
              classId,
              schoolId,
              title: "Retained discussion",
              body: "Shared class discussion",
              tag: "general",
              status: "open",
              isPinned: false,
              postCount: 2,
              nextPostSequence: 3,
              reactionCounts: [],
              lastPostAt: NOW,
              lastPostBy: otherUserId,
              createdBy: otherUserId,
              updatedAt: NOW,
            });
            const deletedPostId = await ctx.db.insert("schoolClassForumPosts", {
              forumId,
              classId,
              body: "Deleted personal post",
              mentions: [],
              replyCount: 1,
              reactionCounts: [],
              sequence: 1,
              createdBy: userId,
              updatedAt: NOW,
            });
            const retainedPostId = await ctx.db.insert(
              "schoolClassForumPosts",
              {
                forumId,
                classId,
                body: "Retained reply",
                mentions: [],
                parentId: deletedPostId,
                replyToUserId: userId,
                replyToBody: "Deleted personal post",
                replyCount: 0,
                reactionCounts: [],
                sequence: 2,
                createdBy: otherUserId,
                updatedAt: NOW,
              }
            );
            const deletedForumId = await ctx.db.insert("schoolClassForums", {
              body: "Deleted account forum body",
              classId,
              createdBy: userId,
              isPinned: false,
              lastPostAt: NOW,
              lastPostBy: otherUserId,
              nextPostSequence: 2,
              postCount: 1,
              reactionCounts: [],
              schoolId,
              status: "open",
              tag: "general",
              title: "Deleted account forum",
              updatedAt: NOW,
            });
            await ctx.db.insert("schoolClassForumPosts", {
              body: "Dependent shared reply",
              classId,
              createdBy: otherUserId,
              forumId: deletedForumId,
              mentions: [],
              reactionCounts: [],
              replyCount: 0,
              sequence: 1,
              updatedAt: NOW,
            });
            await ctx.db.insert("schoolClassForumReactions", {
              emoji: "👍",
              forumId: deletedForumId,
              userId: otherUserId,
            });
            await ctx.db.insert("schoolActivityLogs", {
              schoolId,
              userId: otherUserId,
              action: "member_invited",
              entityType: "schoolMembers",
              entityId: "deleted-membership",
              metadata: {
                invitedUserId: userId,
                role: "student",
              },
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
              deletedForum: await ctx.db.get(
                "schoolClassForums",
                deletedForumId
              ),
              deletedForumPosts: await ctx.db
                .query("schoolClassForumPosts")
                .withIndex("by_forumId_and_sequence", (query) =>
                  query.eq("forumId", deletedForumId)
                )
                .collect(),
              deletedForumReactions: await ctx.db
                .query("schoolClassForumReactions")
                .withIndex("by_forumId_and_emoji_and_userId", (query) =>
                  query.eq("forumId", deletedForumId)
                )
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
              retainedPost: await ctx.db.get(
                "schoolClassForumPosts",
                retainedPostId
              ),
              schoolActivity: await ctx.db
                .query("schoolActivityLogs")
                .withIndex("by_schoolId", (query) =>
                  query.eq("schoolId", schoolId)
                )
                .collect(),
              user: await ctx.db.get("users", userId),
            };
          })
        );
        expect(result).toEqual({
          chats: [],
          consentDecisions: [],
          consents: [],
          creditTransactions: [],
          deletedForum: null,
          deletedForumPosts: [],
          deletedForumReactions: [],
          learningPreferences: [],
          referencedComment: expect.objectContaining({
            text: "Reply without retained personal preview",
          }),
          retainedPost: expect.objectContaining({
            body: "Retained reply",
          }),
          schoolActivity: [],
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
        expect(result.referencedComment).not.toHaveProperty("replyToText");
        expect(result.referencedComment).not.toHaveProperty("replyToUserId");
        expect(result.retainedPost).not.toHaveProperty("parentId");
        expect(result.retainedPost).not.toHaveProperty("replyToBody");
        expect(result.retainedPost).not.toHaveProperty("replyToUserId");
      })
  );
});
