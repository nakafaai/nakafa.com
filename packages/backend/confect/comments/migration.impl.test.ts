import { Ref } from "@confect/core";
import { afterEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { api } from "@repo/backend/convex/_generated/api";
import { Array as Arr } from "effect";

const run = Ref.getFunctionReference(refs.internal.comments.migration.run);
const likeComment = Ref.getFunctionReference(
  refs.public.comments.mutations.likeComment
);
const now = Date.UTC(2026, 8, 1);

afterEach(() => vi.useRealTimers());

describe("comments/migration (one-off)", () => {
  it("links a reply chain into its top-level comment, and makes a comment whose parent is gone top-level", async () => {
    const t = createConvexTestWithBetterAuth();
    const author = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now, suffix: "migrated-author" })
    );
    const ids = await t.mutation(async (ctx) => {
      const base = {
        downvoteCount: 0,
        replyCount: 0,
        slug: "articles/migration",
        upvoteCount: 0,
        userId: author.userId,
      };
      const root = await ctx.db.insert("comments", { ...base, text: "Root" });
      const reply = await ctx.db.insert("comments", {
        ...base,
        parentId: root,
        text: "Reply",
      });
      const nested = await ctx.db.insert("comments", {
        ...base,
        parentId: reply,
        text: "Nested",
      });
      const gone = await ctx.db.insert("comments", { ...base, text: "Gone" });
      const orphan = await ctx.db.insert("comments", {
        ...base,
        parentId: gone,
        text: "Orphan",
      });
      await ctx.db.delete("comments", gone);
      const orphanChild = await ctx.db.insert("comments", {
        ...base,
        parentId: orphan,
        text: "Child of orphan",
      });
      return { nested, orphan, orphanChild, reply, root };
    });

    expect(await t.mutation(run, {})).toEqual({
      done: true,
      likesAdded: 0,
      linked: 4,
      orphaned: 1,
      recounted: 0,
      scanned: 5,
      votesRemoved: 0,
    });

    const rows = await t.query(async (ctx) => ({
      nested: await ctx.db.get("comments", ids.nested),
      orphan: await ctx.db.get("comments", ids.orphan),
      orphanChild: await ctx.db.get("comments", ids.orphanChild),
      reply: await ctx.db.get("comments", ids.reply),
      root: await ctx.db.get("comments", ids.root),
    }));
    expect(rows.root).toMatchObject({ likeCount: 0 });
    expect(rows.root?.parentId).toBeUndefined();
    expect(rows.root?.threadId).toBeUndefined();
    expect(rows.reply).toMatchObject({
      likeCount: 0,
      parentId: ids.root,
      threadId: ids.root,
    });
    expect(rows.nested).toMatchObject({
      likeCount: 0,
      parentId: ids.reply,
      threadId: ids.root,
    });
    expect(rows.orphan).toMatchObject({ likeCount: 0 });
    expect(rows.orphan?.parentId).toBeUndefined();
    expect(rows.orphan?.threadId).toBeUndefined();
    expect(rows.orphanChild).toMatchObject({
      likeCount: 0,
      parentId: ids.orphan,
      threadId: ids.orphan,
    });
  });

  it("turns each up vote into a like unless the learner already liked the comment, and removes every vote row", async () => {
    const t = createConvexTestWithBetterAuth();
    const [author, liker, voter, downer] = await t.mutation(async (ctx) =>
      Promise.all(
        Arr.map(["migrated-author", "liker", "voter", "downer"], (suffix) =>
          seedAuthenticatedUser(ctx, { now, suffix })
        )
      )
    );
    const commentId = await t.mutation((ctx) =>
      ctx.db.insert("comments", {
        downvoteCount: 0,
        replyCount: 0,
        slug: "articles/votes",
        text: "Voted before the likes",
        upvoteCount: 2,
        userId: author.userId,
      })
    );
    // The liker's like is made through the mutation, so the count already holds it.
    await t
      .withIdentity({
        subject: liker.authUserId,
        sessionId: liker.sessionId,
      })
      .mutation(likeComment, { commentId });
    await t.mutation(async (ctx) => {
      await ctx.db.insert("commentVotes", {
        commentId,
        userId: voter.userId,
        vote: 1,
      });
      await ctx.db.insert("commentVotes", {
        commentId,
        userId: liker.userId,
        vote: 1,
      });
      await ctx.db.insert("commentVotes", {
        commentId,
        userId: downer.userId,
        vote: -1,
      });
    });

    expect(await t.mutation(run, {})).toMatchObject({
      likesAdded: 1,
      votesRemoved: 3,
    });

    expect(
      await t.query(async (ctx) => ({
        comment: await ctx.db.get("comments", commentId),
        likes: Arr.map(
          await ctx.db.query("commentLikes").collect(),
          (like) => ({ userId: like.userId })
        ),
        votes: await ctx.db.query("commentVotes").collect(),
      }))
    ).toMatchObject({
      comment: { likeCount: 2 },
      likes: expect.arrayContaining([
        { userId: liker.userId },
        { userId: voter.userId },
      ]),
      votes: [],
    });
  });

  it("writes nothing when it runs again over a table it has already migrated", async () => {
    const t = createConvexTestWithBetterAuth();
    const author = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now, suffix: "again-author" })
    );
    await t.mutation(async (ctx) => {
      const root = await ctx.db.insert("comments", {
        downvoteCount: 0,
        replyCount: 0,
        slug: "articles/again",
        text: "Root",
        upvoteCount: 0,
        userId: author.userId,
      });
      await ctx.db.insert("comments", {
        downvoteCount: 0,
        parentId: root,
        replyCount: 0,
        slug: "articles/again",
        text: "Reply",
        upvoteCount: 0,
        userId: author.userId,
      });
    });
    await t.mutation(run, {});

    expect(await t.mutation(run, {})).toEqual({
      done: true,
      likesAdded: 0,
      linked: 0,
      orphaned: 0,
      recounted: 0,
      scanned: 2,
      votesRemoved: 0,
    });
  });

  it("reads fifty comments a call and schedules the next page, until every comment holds its count", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const t = createConvexTestWithBetterAuth();
    const author = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now, suffix: "paged-author" })
    );
    await t.mutation(async (ctx) => {
      for (let index = 0; index < 51; index += 1) {
        await ctx.db.insert("comments", {
          downvoteCount: 0,
          replyCount: 0,
          slug: "articles/paged",
          text: `Comment ${index}`,
          upvoteCount: 0,
          userId: author.userId,
        });
      }
    });

    expect(await t.mutation(run, {})).toMatchObject({
      done: false,
      scanned: 50,
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers, 150);

    const rows = await t.query((ctx) => ctx.db.query("comments").collect());
    expect(rows).toHaveLength(51);
    expect(Arr.every(rows, (row) => row.likeCount === 0)).toBe(true);
  });

  it("sets the reply count of each top-level comment to the size of its thread, counting a thread longer than one batch", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const t = createConvexTestWithBetterAuth();
    const author = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now, suffix: "recount-author" })
    );
    const ids = await t.mutation(async (ctx) => {
      const base = {
        downvoteCount: 0,
        likeCount: 0,
        slug: "articles/recount",
        upvoteCount: 0,
        userId: author.userId,
      };
      const parent = await ctx.db.insert("comments", {
        ...base,
        replyCount: 7,
        text: "Parent with a long thread",
      });
      // More replies than one batch of a cleanup holds, so the count covers more than a batch.
      for (let index = 0; index < 105; index += 1) {
        await ctx.db.insert("comments", {
          ...base,
          parentId: parent,
          replyCount: 0,
          text: `Reply ${index}`,
          threadId: parent,
        });
      }
      const empty = await ctx.db.insert("comments", {
        ...base,
        replyCount: 0,
        text: "Comment without replies",
      });
      return { empty, parent };
    });

    expect(await t.mutation(run, { recount: true })).toMatchObject({
      recounted: 1,
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers, 150);
    expect(
      await t.query(async (ctx) => ({
        empty: await ctx.db.get("comments", ids.empty),
        parent: await ctx.db.get("comments", ids.parent),
      }))
    ).toMatchObject({
      empty: { replyCount: 0 },
      parent: { replyCount: 105 },
    });
    expect(await t.mutation(run, { recount: true })).toMatchObject({
      recounted: 0,
    });
  });

  it("starts the thread of a reply written before the migration under an orphan, whose parent is gone", async () => {
    const t = createConvexTestWithBetterAuth();
    const [author, replier] = await t.mutation(async (ctx) =>
      Promise.all(
        Arr.map(["window-author", "window-replier"], (suffix) =>
          seedAuthenticatedUser(ctx, { now, suffix })
        )
      )
    );
    const orphanId = await t.mutation(async (ctx) => {
      const gone = await ctx.db.insert("comments", {
        downvoteCount: 0,
        replyCount: 0,
        slug: "articles/window",
        text: "Gone",
        upvoteCount: 0,
        userId: author.userId,
      });
      const orphan = await ctx.db.insert("comments", {
        downvoteCount: 0,
        parentId: gone,
        replyCount: 0,
        slug: "articles/window",
        text: "Orphan before the migration",
        upvoteCount: 0,
        userId: author.userId,
      });
      await ctx.db.delete("comments", gone);
      return orphan;
    });

    // The reply arrives before the migration has run, so the orphan holds no thread yet.
    const replyId = await t
      .withIdentity({
        subject: replier.authUserId,
        sessionId: replier.sessionId,
      })
      .mutation(api.comments.mutations.addComment, {
        parentId: orphanId,
        slug: "articles/window",
        text: "Reply in the window",
      });

    expect(
      await t.query((ctx) => ctx.db.get("comments", replyId))
    ).toMatchObject({ parentId: orphanId, threadId: orphanId });
    expect(
      await t.query((ctx) => ctx.db.get("comments", orphanId))
    ).toMatchObject({ replyCount: 1 });
  });

  it("threads a reply to a reply written before the migration through the chain up to its top-level comment", async () => {
    const t = createConvexTestWithBetterAuth();
    const [author, replier] = await t.mutation(async (ctx) =>
      Promise.all(
        Arr.map(["chain-author", "chain-replier"], (suffix) =>
          seedAuthenticatedUser(ctx, { now, suffix })
        )
      )
    );
    const ids = await t.mutation(async (ctx) => {
      const root = await ctx.db.insert("comments", {
        downvoteCount: 0,
        replyCount: 0,
        slug: "articles/chain",
        text: "Root before the migration",
        upvoteCount: 0,
        userId: author.userId,
      });
      const legacyReply = await ctx.db.insert("comments", {
        downvoteCount: 0,
        parentId: root,
        replyCount: 0,
        slug: "articles/chain",
        text: "Reply before the migration",
        upvoteCount: 0,
        userId: author.userId,
      });
      return { legacyReply, root };
    });

    // The new reply names a reply that holds no thread yet, so its thread is found by walking up.
    const replyId = await t
      .withIdentity({
        subject: replier.authUserId,
        sessionId: replier.sessionId,
      })
      .mutation(api.comments.mutations.addComment, {
        parentId: ids.legacyReply,
        slug: "articles/chain",
        text: "Reply to the reply in the window",
      });

    expect(
      await t.query((ctx) => ctx.db.get("comments", replyId))
    ).toMatchObject({ parentId: ids.legacyReply, threadId: ids.root });
    expect(
      await t.query((ctx) => ctx.db.get("comments", ids.root))
    ).toMatchObject({ replyCount: 1 });
  });
});
