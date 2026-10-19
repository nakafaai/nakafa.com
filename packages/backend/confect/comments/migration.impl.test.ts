import { Ref } from "@confect/core";
import { afterEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { Array as Arr } from "effect";

const run = Ref.getFunctionReference(refs.internal.comments.migration.run);
const now = Date.UTC(2026, 8, 1);

afterEach(() => vi.useRealTimers());

describe("comments/migration (strip pass)", () => {
  it("strips the three legacy fields from a comment that holds them, and counts that comment", async () => {
    const t = createConvexTestWithBetterAuth();
    const author = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now, suffix: "strip-author" })
    );
    const ids = await t.mutation(async (ctx) => {
      const root = await ctx.db.insert("comments", {
        likeCount: 0,
        replyCount: 1,
        slug: "articles/strip",
        text: "Current root",
        userId: author.userId,
      });
      const reply = await ctx.db.insert("comments", {
        downvoteCount: 1,
        likeCount: 2,
        parentId: root,
        replyCount: 0,
        replyToText: "Current root",
        slug: "articles/strip",
        text: "Reply written before the likes",
        threadId: root,
        upvoteCount: 3,
        userId: author.userId,
      });
      return { reply, root };
    });

    expect(await t.mutation(run, {})).toEqual({
      done: true,
      scanned: 2,
      stripped: 1,
      votesRemoved: 0,
    });

    const rows = await t.query(async (ctx) => ({
      reply: await ctx.db.get("comments", ids.reply),
      root: await ctx.db.get("comments", ids.root),
    }));
    expect(rows.reply).toMatchObject({
      likeCount: 2,
      parentId: ids.root,
      text: "Reply written before the likes",
      threadId: ids.root,
    });
    expect(rows.reply).not.toHaveProperty("upvoteCount");
    expect(rows.reply).not.toHaveProperty("downvoteCount");
    expect(rows.reply).not.toHaveProperty("replyToText");
  });

  it("leaves a comment that holds none of the legacy fields as it is, and does not count it", async () => {
    const t = createConvexTestWithBetterAuth();
    const author = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now, suffix: "current-author" })
    );
    const current = await t.mutation((ctx) =>
      ctx.db.insert("comments", {
        likeCount: 1,
        replyCount: 0,
        slug: "articles/current",
        text: "Written after the likes",
        userId: author.userId,
      })
    );
    const before = await t.query((ctx) => ctx.db.get("comments", current));

    expect(await t.mutation(run, {})).toEqual({
      done: true,
      scanned: 1,
      stripped: 0,
      votesRemoved: 0,
    });
    expect(await t.query((ctx) => ctx.db.get("comments", current))).toEqual(
      before
    );
  });

  it("deletes the vote rows fifty at a time, and reads no comment while any is left", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const t = createConvexTestWithBetterAuth();
    const author = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now, suffix: "votes-author" })
    );
    const commentId = await t.mutation(async (ctx) => {
      const id = await ctx.db.insert("comments", {
        likeCount: 0,
        replyCount: 0,
        slug: "articles/votes",
        text: "Voted before the likes",
        upvoteCount: 120,
        userId: author.userId,
      });
      for (let index = 0; index < 120; index += 1) {
        await ctx.db.insert("commentVotes", {
          commentId: id,
          userId: author.userId,
          vote: 1,
        });
      }
      return id;
    });
    const votes = () =>
      t.query((ctx) => ctx.db.query("commentVotes").collect());
    const comment = () => t.query((ctx) => ctx.db.get("comments", commentId));

    expect(await t.mutation(run, {})).toEqual({
      done: false,
      scanned: 0,
      stripped: 0,
      votesRemoved: 50,
    });
    expect(await votes()).toHaveLength(70);
    expect(await comment()).toMatchObject({ upvoteCount: 120 });

    await t.finishAllScheduledFunctions(vi.runAllTimers, 150);

    expect(await votes()).toEqual([]);
    expect(await comment()).not.toHaveProperty("upvoteCount");
  });

  it("reads fifty comments a call, schedules the next page, and schedules nothing after the last one", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const t = createConvexTestWithBetterAuth();
    const author = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now, suffix: "paged-author" })
    );
    await t.mutation(async (ctx) => {
      for (let index = 0; index < 51; index += 1) {
        await ctx.db.insert("comments", {
          likeCount: 0,
          replyCount: 0,
          slug: "articles/paged",
          text: `Comment ${index}`,
          upvoteCount: 0,
          userId: author.userId,
        });
      }
    });
    const jobs = () =>
      t.query((ctx) => ctx.db.system.query("_scheduled_functions").collect());

    expect(await t.mutation(run, {})).toEqual({
      done: false,
      scanned: 50,
      stripped: 50,
      votesRemoved: 0,
    });
    expect(await jobs()).toHaveLength(1);

    await t.finishAllScheduledFunctions(vi.runAllTimers, 150);

    const rows = await t.query((ctx) => ctx.db.query("comments").collect());
    expect(Arr.every(rows, (row) => row.upvoteCount === undefined)).toBe(true);
    const finished = await jobs();
    expect(finished).toHaveLength(1);
    expect(Arr.every(finished, (job) => job.state.kind === "success")).toBe(
      true
    );
  });

  it("reports zero stripped comments and zero removed votes when it runs again", async () => {
    const t = createConvexTestWithBetterAuth();
    const author = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now, suffix: "again-author" })
    );
    await t.mutation((ctx) =>
      ctx.db.insert("comments", {
        downvoteCount: 0,
        likeCount: 0,
        replyCount: 0,
        slug: "articles/again",
        text: "Written before the likes",
        upvoteCount: 0,
        userId: author.userId,
      })
    );
    await t.mutation(run, {});

    expect(await t.mutation(run, {})).toEqual({
      done: true,
      scanned: 1,
      stripped: 0,
      votesRemoved: 0,
    });
  });
});
