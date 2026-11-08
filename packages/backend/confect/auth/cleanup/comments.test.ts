import { afterEach, expect, it } from "@effect/vitest";
import { createDeletedUserTombstone } from "@repo/backend/confect/auth/deletion/tombstone";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { internal } from "@repo/backend/convex/_generated/api";
import { Array as Arr } from "effect";

afterEach(() => vi.useRealTimers());

it("keeps every reply other learners wrote when an account goes, and rebuilds the threads around them", async () => {
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
  const now = Date.UTC(2026, 9, 18);
  vi.setSystemTime(now);
  const t = createConvexTestWithBetterAuth();
  const seeded = await t.mutation(async (ctx) => {
    const owner = (await seedAuthenticatedUser(ctx, { now, suffix: "gone" }))
      .userId;
    const retained = (
      await seedAuthenticatedUser(ctx, { now, suffix: "stays" })
    ).userId;
    const row = {
      likeCount: 0,
      replyCount: 0,
      slug: "material/algebra",
    };
    const top = await ctx.db.insert("comments", {
      ...row,
      replyCount: 4,
      text: "Owner's question",
      userId: owner,
    });
    const answer = await ctx.db.insert("comments", {
      ...row,
      parentId: top,
      replyToUserId: owner,
      text: "An answer",
      threadId: top,
      userId: retained,
    });
    const thanks = await ctx.db.insert("comments", {
      ...row,
      parentId: answer,
      replyToUserId: retained,
      text: "Thanks",
      threadId: top,
      userId: retained,
    });
    const follow = await ctx.db.insert("comments", {
      ...row,
      parentId: answer,
      replyToUserId: retained,
      text: "Owner's follow-up",
      threadId: top,
      userId: owner,
    });
    const reply = await ctx.db.insert("comments", {
      ...row,
      parentId: follow,
      replyToUserId: owner,
      text: "A reply to the follow-up",
      threadId: top,
      userId: retained,
    });
    // A parent that is already gone leaves its reply at the top of its own thread.
    const gone = await ctx.db.insert("comments", {
      ...row,
      parentId: answer,
      replyToUserId: retained,
      text: "Gone",
      threadId: top,
      userId: retained,
    });
    const orphan = await ctx.db.insert("comments", {
      ...row,
      parentId: gone,
      replyToUserId: retained,
      text: "Orphan",
      threadId: top,
      userId: retained,
    });
    await ctx.db.delete(gone);
    // A member of the thread with no parent is the top of its own thread too.
    const stray = await ctx.db.insert("comments", {
      ...row,
      text: "Stray",
      threadId: top,
      userId: retained,
    });
    await ctx.db.patch(owner, createDeletedUserTombstone(owner, now));
    return {
      answer,
      follow,
      orphan,
      owner,
      reply,
      retained,
      stray,
      thanks,
      top,
    };
  });
  while (
    await t.mutation(internal.auth.cleanup.cleanupDeletedUser, {
      userId: seeded.owner,
    })
  ) {
    // Each pass handles one batch of what is left.
  }
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  const read = await t.query(async (ctx) => ({
    answer: await ctx.db.get(seeded.answer),
    follow: await ctx.db.get(seeded.follow),
    orphan: await ctx.db.get(seeded.orphan),
    reply: await ctx.db.get(seeded.reply),
    stray: await ctx.db.get(seeded.stray),
    thanks: await ctx.db.get(seeded.thanks),
    top: await ctx.db.get(seeded.top),
  }));
  expect(read.top).toBeNull();
  expect(read.follow).toBeNull();
  expect(read.answer).toMatchObject({ replyCount: 2, text: "An answer" });
  expect(read.answer).not.toHaveProperty("parentId");
  expect(read.answer).not.toHaveProperty("threadId");
  expect(read.answer).not.toHaveProperty("replyToUserId");
  expect(read.thanks).toMatchObject({
    parentId: seeded.answer,
    threadId: seeded.answer,
  });
  expect(read.reply).toMatchObject({
    parentId: seeded.answer,
    replyToUserId: seeded.retained,
    threadId: seeded.answer,
  });
  expect(read.orphan).toMatchObject({ replyCount: 0, text: "Orphan" });
  expect(read.orphan).not.toHaveProperty("parentId");
  expect(read.orphan).not.toHaveProperty("threadId");
  expect(read.stray).not.toHaveProperty("threadId");
});

it("deletes a learner's reports and unposted photos when the account goes, and keeps other learners' reports", async () => {
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
  const now = Date.UTC(2026, 10, 8);
  vi.setSystemTime(now);
  const t = createConvexTestWithBetterAuth();
  const seeded = await t.mutation(async (ctx) => {
    const owner = (await seedAuthenticatedUser(ctx, { now, suffix: "gone" }))
      .userId;
    const retained = (
      await seedAuthenticatedUser(ctx, { now, suffix: "stays" })
    ).userId;
    const commentId = await ctx.db.insert("comments", {
      likeCount: 0,
      replyCount: 0,
      slug: "material/algebra",
      text: "Reported twice",
      userId: retained,
    });
    await ctx.db.insert("commentReports", {
      commentId,
      createdAt: now,
      reason: "spam",
      userId: owner,
    });
    const kept = await ctx.db.insert("commentReports", {
      commentId,
      createdAt: now,
      reason: "other",
      userId: retained,
    });
    const fileId = await ctx.db.insert("bucketFiles", {
      byteSize: 10,
      contentType: "image/png",
      createdAt: now,
      objectKey: "files/accounts/unposted",
      state: "stored",
    });
    await ctx.db.insert("commentUploads", {
      createdAt: now,
      fileId,
      height: 10,
      userId: owner,
      width: 10,
    });
    await ctx.db.patch(owner, createDeletedUserTombstone(owner, now));
    return { kept, owner };
  });
  while (
    await t.mutation(internal.auth.cleanup.cleanupDeletedUser, {
      userId: seeded.owner,
    })
  ) {
    // Each pass handles one batch of what is left.
  }
  const read = await t.query(async (ctx) => ({
    files: await ctx.db.query("bucketFiles").collect(),
    reports: await ctx.db.query("commentReports").collect(),
    uploads: await ctx.db.query("commentUploads").collect(),
  }));
  expect(Arr.map(read.reports, (report) => report._id)).toEqual([seeded.kept]);
  expect(read.uploads).toEqual([]);
  expect(read.files).toEqual([]);
});
