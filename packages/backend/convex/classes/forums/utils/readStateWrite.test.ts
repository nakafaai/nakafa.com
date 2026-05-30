import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { updateForumReadState } from "@repo/backend/convex/classes/forums/utils/readStateWrite";
import {
  insertClass,
  insertSchool,
} from "@repo/backend/convex/classes/test.helpers";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { describe, expect, it } from "vitest";

const NOW = Date.UTC(2026, 4, 29, 9, 0, 0);

/** Insert the smallest forum graph needed by read-state writes. */
async function insertForumReadStateTarget(ctx: MutationCtx) {
  const viewer = await seedAuthenticatedUser(ctx, {
    now: NOW,
    suffix: "forum-read-state",
  });
  const schoolId = await insertSchool(ctx, {
    now: NOW,
    userId: viewer.userId,
  });
  const classId = await insertClass(ctx, {
    now: NOW,
    schoolId,
    userId: viewer.userId,
  });
  const forumId = await ctx.db.insert("schoolClassForums", {
    body: "Read state body",
    classId,
    createdBy: viewer.userId,
    isPinned: false,
    lastPostAt: NOW,
    lastPostBy: viewer.userId,
    nextPostSequence: 1,
    postCount: 0,
    reactionCounts: [],
    schoolId,
    status: "open",
    tag: "general",
    title: "Read state forum",
    updatedAt: NOW,
  });

  return {
    classId,
    forumId,
    userId: viewer.userId,
  };
}

/** Load one read state by the same index used by the write helper. */
async function loadReadState(
  ctx: MutationCtx,
  {
    forumId,
    userId,
  }: {
    forumId: Id<"schoolClassForums">;
    userId: Id<"users">;
  }
) {
  return await ctx.db
    .query("schoolClassForumReadStates")
    .withIndex("by_forumId_and_userId", (q) =>
      q.eq("forumId", forumId).eq("userId", userId)
    )
    .unique();
}

describe("classes/forums/utils/readStateWrite:updateForumReadState", () => {
  it("creates a read state when none exists", async () => {
    const t = createConvexTestWithBetterAuth();
    const result = await t.mutation(async (ctx) => {
      const target = await insertForumReadStateTarget(ctx);

      await updateForumReadState(ctx, {
        ...target,
        lastReadSequence: 3,
      });

      return await loadReadState(ctx, target);
    });

    expect(result).toMatchObject({
      lastReadSequence: 3,
    });
  });

  it("keeps the existing boundary when the next sequence is older", async () => {
    const t = createConvexTestWithBetterAuth();
    const result = await t.mutation(async (ctx) => {
      const target = await insertForumReadStateTarget(ctx);

      await updateForumReadState(ctx, {
        ...target,
        lastReadSequence: 5,
      });
      await updateForumReadState(ctx, {
        ...target,
        lastReadSequence: 4,
      });

      return await loadReadState(ctx, target);
    });

    expect(result).toMatchObject({
      lastReadSequence: 5,
    });
  });

  it("advances the boundary when the next sequence is newer", async () => {
    const t = createConvexTestWithBetterAuth();
    const result = await t.mutation(async (ctx) => {
      const target = await insertForumReadStateTarget(ctx);

      await updateForumReadState(ctx, {
        ...target,
        lastReadSequence: 5,
      });
      await updateForumReadState(ctx, {
        ...target,
        lastReadSequence: 6,
      });

      return await loadReadState(ctx, target);
    });

    expect(result).toMatchObject({
      lastReadSequence: 6,
    });
  });
});
