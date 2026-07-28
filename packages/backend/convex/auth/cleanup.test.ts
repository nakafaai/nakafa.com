import { internal } from "@repo/backend/convex/_generated/api";
import { drainDeletedUserDataProgram } from "@repo/backend/convex/auth/cleanup";
import { cleanupDeletedUserProgram } from "@repo/backend/convex/auth/cleanup/impl";
import { createDeletedUserTombstone } from "@repo/backend/convex/auth/deletion/tombstone";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

const NOW = Date.UTC(2026, 6, 22, 8, 0, 0);
const deletedAuthIdPattern = /^deleted:/;
const deletedEmailPattern = /^deleted-.+@account\.nakafa\.invalid$/;

describe("auth/cleanup", () => {
  it("drains every committed local cleanup batch outside the workflow journal", async () => {
    const cleanupBatch = vi
      .fn<() => Promise<boolean>>()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    await Effect.runPromise(drainDeletedUserDataProgram(cleanupBatch));

    expect(cleanupBatch).toHaveBeenCalledTimes(3);
  });

  it("stops after the first cleanup batch that makes progress", async () => {
    const t = convexTest(schema, convexModules);
    const state = await t.mutation(async (ctx) => {
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
      const preferenceId = await ctx.db.insert("notificationPreferences", {
        disabledTypes: [],
        emailDigest: "weekly",
        emailEnabled: true,
        updatedAt: NOW,
        userId,
      });
      const collectionId = await ctx.db.insert("bookmarkCollections", {
        bookmarkCount: 1,
        image: "default",
        isDefault: true,
        isPublic: false,
        name: "Saved",
        order: 0,
        updatedAt: NOW,
        userId,
      });
      const bookmarkId = await ctx.db.insert("bookmarks", {
        bookmarkedAt: NOW,
        collectionId,
        order: 0,
        slug: "material/algebra",
        userId,
      });

      return { bookmarkId, preferenceId, userId };
    });

    const hasMore = await t.mutation(internal.auth.cleanup.cleanupDeletedUser, {
      userId: state.userId,
    });
    const remaining = await t.query(async (ctx) => ({
      bookmark: await ctx.db.get("bookmarks", state.bookmarkId),
      preference: await ctx.db.get(
        "notificationPreferences",
        state.preferenceId
      ),
      user: await ctx.db.get("users", state.userId),
    }));

    expect(hasMore).toBe(true);
    expect(remaining.preference).toBeNull();
    expect(remaining.bookmark).not.toBeNull();
    expect(remaining.user).toMatchObject({
      authId: expect.stringMatching(deletedAuthIdPattern),
      email: expect.stringMatching(deletedEmailPattern),
    });
  });

  it("deletes personal data and anonymizes the shared-record identity", async () => {
    const t = convexTest(schema, convexModules);

    const result = await t.mutation(async (ctx) => {
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
      await ctx.db.insert("notificationPreferences", {
        disabledTypes: [],
        emailDigest: "weekly",
        emailEnabled: true,
        userId,
        updatedAt: NOW,
      });
      await ctx.db.insert("tryoutFreeAttemptClaims", {
        claimedAt: NOW,
        countryKey: "indonesia",
        examKey: "snbt",
        setKey: "set-1",
        trackKey: "2027",
        userId,
      });
      const collectionId = await ctx.db.insert("bookmarkCollections", {
        bookmarkCount: 1,
        image: "default",
        isDefault: true,
        isPublic: false,
        name: "Saved",
        order: 0,
        updatedAt: NOW,
        userId,
      });
      await ctx.db.insert("bookmarks", {
        bookmarkedAt: NOW,
        collectionId,
        order: 0,
        slug: "material/algebra",
        userId,
      });
      const chatId = await ctx.db.insert("chats", {
        type: "study",
        updatedAt: NOW,
        userId,
        visibility: "private",
      });
      const messageId = await ctx.db.insert("messages", {
        chatId,
        identifier: "user-1",
        role: "user",
      });
      await ctx.db.insert("messageParts", {
        messageId,
        order: 0,
        textText: "Private question",
        type: "text",
      });
      await ctx.db.insert("ninaCapabilityTraces", {
        capability: "nakafa",
        chatId,
        durationMs: 10,
        endedAt: NOW,
        evidence: {
          capability: "nakafa",
          status: "available",
          summary: "Found a relevant lesson.",
        },
        expiresAt: NOW + 1000,
        responseMessageIdentifier: "response-1",
        startedAt: NOW - 10,
        status: "available",
        userId,
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
      const retainedPostId = await ctx.db.insert("schoolClassForumPosts", {
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
      });
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
        hasMore = await runConvexProgram(
          cleanupDeletedUserProgram(ctx, userId)
        );
      }

      return {
        claims: await ctx.db
          .query("tryoutFreeAttemptClaims")
          .withIndex("by_userId", (query) => query.eq("userId", userId))
          .collect(),
        preferences: await ctx.db
          .query("notificationPreferences")
          .withIndex("by_userId", (query) => query.eq("userId", userId))
          .collect(),
        bookmarks: await ctx.db
          .query("bookmarks")
          .withIndex("by_userId", (query) => query.eq("userId", userId))
          .collect(),
        chats: await ctx.db
          .query("chats")
          .withIndex("by_userId", (query) => query.eq("userId", userId))
          .collect(),
        collections: await ctx.db
          .query("bookmarkCollections")
          .withIndex("by_userId", (query) => query.eq("userId", userId))
          .collect(),
        deletedForum: await ctx.db.get("schoolClassForums", deletedForumId),
        deletedForumPosts: await ctx.db
          .query("schoolClassForumPosts")
          .withIndex("by_forumId", (query) =>
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
        messageParts: await ctx.db
          .query("messageParts")
          .withIndex("by_messageId_and_order", (query) =>
            query.eq("messageId", messageId)
          )
          .collect(),
        messages: await ctx.db
          .query("messages")
          .withIndex("by_chatId", (query) => query.eq("chatId", chatId))
          .collect(),
        referencedComment: await ctx.db.get("comments", referencedCommentId),
        retainedPost: await ctx.db.get("schoolClassForumPosts", retainedPostId),
        schoolActivity: await ctx.db
          .query("schoolActivityLogs")
          .withIndex("by_schoolId", (query) => query.eq("schoolId", schoolId))
          .collect(),
        traces: await ctx.db
          .query("ninaCapabilityTraces")
          .withIndex("by_chatId_and_startedAt", (query) =>
            query.eq("chatId", chatId)
          )
          .collect(),
        user: await ctx.db.get("users", userId),
      };
    });

    expect(result).toEqual({
      bookmarks: [],
      chats: [],
      claims: [],
      collections: [],
      creditTransactions: [],
      deletedForum: null,
      deletedForumPosts: [],
      deletedForumReactions: [],
      learningPreferences: [],
      messageParts: [],
      messages: [],
      preferences: [],
      referencedComment: expect.objectContaining({
        text: "Reply without retained personal preview",
      }),
      retainedPost: expect.objectContaining({
        body: "Retained reply",
      }),
      schoolActivity: [],
      traces: [],
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
  });
});
