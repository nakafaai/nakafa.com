import { Ref } from "@confect/core";
import { afterEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { POST_LIKE_CLEANUP_BATCH_SIZE } from "@repo/backend/confect/posts/cleanup";
import { POST_TEXT_MAX_LENGTH } from "@repo/backend/confect/posts/schema";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import type { Id } from "@repo/backend/convex/_generated/dataModel";

const create = Ref.getFunctionReference(refs.public.posts.mutations.create);
const remove = Ref.getFunctionReference(refs.public.posts.mutations.remove);
const like = Ref.getFunctionReference(refs.public.posts.mutations.like);
const unlike = Ref.getFunctionReference(refs.public.posts.mutations.unlike);
const cleanupDeletedPost = Ref.getFunctionReference(
  refs.internal.posts.cleanup.cleanupDeletedPost
);

const now = Date.UTC(2026, 8, 1);

afterEach(() => vi.useRealTimers());

/** Creates an author and another learner, both signed in. */
async function createPeople() {
  const t = createConvexTestWithBetterAuth();
  const [author, stranger] = await t.mutation(async (ctx) =>
    Promise.all([
      seedAuthenticatedUser(ctx, { now, suffix: "post-author" }),
      seedAuthenticatedUser(ctx, { now, suffix: "post-stranger" }),
    ])
  );
  return {
    t,
    author: {
      session: t.withIdentity({
        subject: author.authUserId,
        sessionId: author.sessionId,
      }),
      userId: author.userId,
    },
    stranger: t.withIdentity({
      subject: stranger.authUserId,
      sessionId: stranger.sessionId,
    }),
  };
}

/** Writes one post of the author and returns its id. */
function writePost(
  author: Awaited<ReturnType<typeof createPeople>>["author"],
  text = "Halo dunia."
) {
  return author.session.mutation(create, { text });
}

describe("posts write contracts", () => {
  it("stores the trimmed text of a new post with no likes, and refuses empty and over-long text", async () => {
    const { t, author } = await createPeople();
    const postId = await writePost(author, "  Halo dunia.  ");
    expect(await t.query((ctx) => ctx.db.get("posts", postId))).toMatchObject({
      authorId: author.userId,
      likeCount: 0,
      text: "Halo dunia.",
    });
    await expect(writePost(author, " \n ")).rejects.toMatchObject({
      data: { code: "POST_TEXT_EMPTY" },
    });
    await expect(
      writePost(author, "a".repeat(POST_TEXT_MAX_LENGTH + 1))
    ).rejects.toMatchObject({
      data: {
        code: "POST_TEXT_TOO_LONG",
        message: `The post must hold 1 to ${POST_TEXT_MAX_LENGTH} characters.`,
      },
    });
    const longest = "a".repeat(POST_TEXT_MAX_LENGTH);
    expect(await writePost(author, longest)).toBeDefined();
  });

  it("lets only the author delete a post, and answers another learner as it answers a post that is gone", async () => {
    const { author, stranger, t } = await createPeople();
    const postId = await writePost(author);
    // The stranger gets the same answer for a post they may not read as for a
    // missing one, so the answer never shows that the post exists.
    await expect(stranger.mutation(remove, { postId })).rejects.toMatchObject({
      data: { code: "POST_NOT_FOUND", message: "Post not found." },
    });
    expect(await t.query((ctx) => ctx.db.get("posts", postId))).not.toBeNull();
    await author.session.mutation(remove, { postId });
    expect(await t.query((ctx) => ctx.db.get("posts", postId))).toBeNull();
    await expect(
      author.session.mutation(remove, { postId })
    ).rejects.toMatchObject({
      data: { code: "POST_NOT_FOUND" },
    });
  });

  it("deletes the likes of a removed post in bounded batches, one pass at a time", async () => {
    vi.useFakeTimers();
    const { author, t } = await createPeople();
    const postId = await writePost(author);
    const likes = POST_LIKE_CLEANUP_BATCH_SIZE + 1;
    await t.mutation(async (ctx) => {
      for (let index = 0; index < likes; index += 1) {
        // One row per learner who liked the post. The batches never depend on who.
        await ctx.db.insert("postLikes", {
          postId,
          userId: author.userId,
        });
      }
    });
    await author.session.mutation(remove, { postId });
    const remaining = () =>
      t
        .query((ctx) => ctx.db.query("postLikes").collect())
        .then((rows) => rows.length);
    expect(await remaining()).toBe(likes);
    // One pass takes one batch and schedules the next, because the batch was full.
    await t.mutation(cleanupDeletedPost, { postId });
    expect(await remaining()).toBe(likes - POST_LIKE_CLEANUP_BATCH_SIZE);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await remaining()).toBe(0);
  });

  it("removes the likes of a short post in one pass, and schedules nothing more", async () => {
    vi.useFakeTimers();
    const { author, t } = await createPeople();
    const postId = await writePost(author);
    await t.mutation((ctx) =>
      ctx.db.insert("postLikes", { postId, userId: author.userId })
    );
    await author.session.mutation(remove, { postId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.query((ctx) => ctx.db.query("postLikes").collect())).toEqual(
      []
    );
  });

  it("keeps the like count exact when a like or an unlike repeats", async () => {
    const { t, author } = await createPeople();
    const postId = await writePost(author);
    const count = () =>
      t
        .query((ctx) => ctx.db.get("posts", postId))
        .then((post) => post?.likeCount);
    await author.session.mutation(like, { postId });
    await author.session.mutation(like, { postId });
    expect(await count()).toBe(1);
    expect(
      await t.query((ctx) => ctx.db.query("postLikes").collect())
    ).toHaveLength(1);
    await author.session.mutation(unlike, { postId });
    await author.session.mutation(unlike, { postId });
    expect(await count()).toBe(0);
    expect(await t.query((ctx) => ctx.db.query("postLikes").collect())).toEqual(
      []
    );
  });

  it("refuses a like or an unlike by a learner who may not read the post, and a missing post", async () => {
    const { author, stranger, t } = await createPeople();
    const postId: Id<"posts"> = await writePost(author);
    await expect(stranger.mutation(like, { postId })).rejects.toMatchObject({
      data: { code: "POST_NOT_FOUND" },
    });
    await expect(stranger.mutation(unlike, { postId })).rejects.toMatchObject({
      data: { code: "POST_NOT_FOUND" },
    });
    expect(await t.query((ctx) => ctx.db.query("postLikes").collect())).toEqual(
      []
    );
    await author.session.mutation(remove, { postId });
    await expect(
      author.session.mutation(like, { postId })
    ).rejects.toMatchObject({
      data: { code: "POST_NOT_FOUND" },
    });
  });
});
