import { Ref } from "@confect/core";
import { afterEach, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { createDeletedUserTombstone } from "@repo/backend/confect/auth/deletion/tombstone";
import { MEMORY_BATCH } from "@repo/backend/confect/nina/memory/store";
import { POST_LIKE_CLEANUP_BATCH_SIZE } from "@repo/backend/confect/posts/cleanup";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { internal } from "@repo/backend/convex/_generated/api";
import { createMemoryTest, insertMemory } from "@repo/backend/test/nina/memory";
import { createPortraitTest } from "@repo/backend/test/nina/portrait";
import { Array as Arr } from "effect";

const capture = Ref.getFunctionReference(refs.internal.nina.memory.capture);
const pause = Ref.getFunctionReference(refs.public.nina.memory.pause);
const remove = Ref.getFunctionReference(refs.public.nina.memory.remove);

afterEach(() => vi.useRealTimers());

/** Creates the account that will be deleted and one that stays, both still live. */
async function createOwners(suffix: string) {
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
  const now = Date.UTC(2026, 8, 27);
  vi.setSystemTime(now);
  const t = createConvexTestWithBetterAuth();
  const users = await t.mutation(async (ctx) => {
    const owner = await seedAuthenticatedUser(ctx, {
      now,
      suffix: `deleted-${suffix}`,
    });
    const retained = await seedAuthenticatedUser(ctx, {
      now,
      suffix: `retained-${suffix}`,
    });
    return { owner: owner.userId, retained: retained.userId };
  });
  return { t, now, ...users };
}

/** Marks the owner's account as deleted, the state every cleanup pass runs in. */
function deleteOwner({
  t,
  now,
  owner,
}: Awaited<ReturnType<typeof createOwners>>) {
  return t.mutation((ctx) =>
    ctx.db.patch(owner, createDeletedUserTombstone(owner, now))
  );
}

async function createDeletedOwner(suffix: string) {
  const owners = await createOwners(suffix);
  await deleteOwner(owners);
  return owners;
}

it("deletes the learner's Nina memories and their keys a batch at a time, Nina's and the learner's own, and keeps another learner's", async () => {
  const owners = await createOwners("memory");
  const { t, owner, retained } = owners;
  const left = 5;
  await t.mutation(async (ctx) => {
    for (let index = 0; index < MEMORY_BATCH + left; index += 1) {
      await insertMemory(ctx, {
        author: index % 2 === 0 ? "nina" : "learner",
        text: `Memory ${index}`,
        topics: ["path:materials/mathematics"],
        userId: owner,
      });
    }
    await insertMemory(ctx, { userId: retained });
  });
  // The memories exist before the account is deleted: a deleted account gets
  // no new key, so nothing can be sealed for it afterwards.
  await deleteOwner(owners);
  const memories = () =>
    t.query((ctx) => ctx.db.query("ninaMemories").collect());
  const keys = () => t.query((ctx) => ctx.db.query("ninaMemoryKeys").collect());
  const cleanup = () =>
    t.mutation(internal.auth.cleanup.cleanupDeletedUser, { userId: owner });
  await expect(cleanup()).resolves.toBe(true);
  expect(await memories()).toHaveLength(left + 1);
  await expect(cleanup()).resolves.toBe(true);
  const emptied = await memories();
  expect(emptied).toEqual([expect.objectContaining({ userId: retained })]);
  const retainedKeys = await keys();
  // The other learner's one memory has a key for each of its words, and the
  // learner's keys went with the memories.
  expect(retainedKeys).not.toEqual([]);
  expect(Arr.every(retainedKeys, (key) => key.userId === retained)).toBe(true);
  // The learner's key goes after every row it sealed.
  while (await cleanup()) {
    await t.finishAllScheduledFunctions(vi.runAllTimers);
  }
  expect(await memories()).toEqual(emptied);
  expect(await keys()).toEqual(retainedKeys);
  expect(await t.query((ctx) => ctx.db.query("vaultKeys").collect())).toEqual([
    expect.objectContaining({ userId: retained }),
  ]);
});

it("leaves no memory behind when a capture lands during the deletion, and writes none once the key is gone", async () => {
  vi.useFakeTimers();
  const now = Date.UTC(2026, 9, 10, 12);
  vi.setSystemTime(now);
  const f = await createMemoryTest();
  const userId = f.identity.userId;
  const write = () =>
    f.t.mutation(capture, {
      candidates: [
        { kind: "level", quote: "aku kelas 12", text: "Kelas 12 IPA." },
      ],
      seen: [],
      topics: [],
      turnId: f.turnId,
      userId,
    });
  const cleanup = () =>
    f.t.mutation(internal.auth.cleanup.cleanupDeletedUser, { userId });
  const keys = () => f.t.query((ctx) => ctx.db.query("vaultKeys").collect());
  await f.seed({ author: "learner", text: "Before the deletion" });
  await f.t.mutation((ctx) =>
    ctx.db.patch(userId, createDeletedUserTombstone(userId, now))
  );
  await expect(cleanup()).resolves.toBe(true);
  expect(await f.stored()).toEqual([]);
  expect(await f.keys()).toEqual([]);
  // A capture that was still running lands between two passes, while the key
  // exists. The next pass deletes what it wrote, with its index keys, because
  // every pass looks for memories before the key goes.
  await expect(write()).resolves.toBe(1);
  expect(await f.keys()).not.toEqual([]);
  let passes = 0;
  while (await cleanup()) {
    passes += 1;
  }
  expect(passes).toBeGreaterThan(0);
  expect(await f.stored()).toEqual([]);
  expect(await f.keys()).toEqual([]);
  expect(await keys()).toEqual([]);
  // The turn is still there, but the key is gone and a deleted account gets no
  // new one, so a capture that lands now cannot seal anything.
  await expect(write()).rejects.toThrow();
  expect(await f.stored()).toEqual([]);
  expect(await f.keys()).toEqual([]);
  expect(await keys()).toEqual([]);
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
});

it("retires the learner's upload grants a batch at a time and keeps another learner's", async () => {
  const { t, owner, retained } = await createDeletedOwner("uploads");
  await t.mutation(async (ctx) => {
    for (const userId of [owner, retained]) {
      await ctx.db.insert("ninaUploads", {
        expiresAt: Date.UTC(2026, 8, 28),
        state: { status: "uploading" },
        userId,
      });
    }
  });
  const grants = () => t.query((ctx) => ctx.db.query("ninaUploads").collect());
  await expect(
    t.mutation(internal.auth.cleanup.cleanupDeletedUser, { userId: owner })
  ).resolves.toBe(true);
  expect(await grants()).toEqual([
    expect.objectContaining({ userId: retained }),
  ]);
  await t.finishAllScheduledFunctions(vi.runAllTimers);
});

it("deletes the learner's portrait with their memories, also one that a capture landing during the deletion asked for, and keeps another learner's", async () => {
  vi.useFakeTimers();
  const now = Date.UTC(2026, 9, 10, 12);
  vi.setSystemTime(now);
  const f = await createPortraitTest();
  const userId = f.identity.userId;
  const other = await f.stranger();
  await f.seed({ author: "learner", text: "Before the deletion" });
  await f.seedPortrait({ text: "Kelas 12." });
  await f.seedPortrait({ text: "Kelas 11.", userId: other.userId });
  await f.t.mutation((ctx) =>
    ctx.db.patch(userId, createDeletedUserTombstone(userId, now))
  );
  const cleanup = () =>
    f.t.mutation(internal.auth.cleanup.cleanupDeletedUser, { userId });
  const owners = async () => Arr.map(await f.rows(), (row) => row.userId);
  await expect(cleanup()).resolves.toBe(true);
  expect(await owners()).toEqual([other.userId]);
  // A capture that was still running lands between two passes and asks for a
  // portrait of its own, and the next pass deletes that one too.
  await expect(
    f.t.mutation(capture, {
      candidates: [
        { kind: "level", quote: "aku kelas 12", text: "Kelas 12 IPA." },
      ],
      seen: [],
      topics: [],
      turnId: f.turnId,
      userId,
    })
  ).resolves.toBe(1);
  expect(await owners()).toEqual([other.userId, userId]);
  while (await cleanup()) {
    // Each pass deletes one batch of what is left.
  }
  expect(await owners()).toEqual([other.userId]);
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(await owners()).toEqual([other.userId]);
});

it("deletes the records that keep a deleted memory for the restore window with the learner's memories, and keeps another learner's", async () => {
  vi.useFakeTimers();
  const now = Date.UTC(2026, 9, 10, 12);
  vi.setSystemTime(now);
  const f = await createMemoryTest();
  const userId = f.identity.userId;
  const other = await f.stranger();
  // Memory is paused for both, so a deletion asks for no portrait and the
  // records are the only rows left to delete.
  await f.owner.mutation(pause, { paused: true });
  await other.owner.mutation(pause, { paused: true });
  const mine = await f.seed({ author: "learner", text: "Mine" });
  const theirs = await f.seed({
    author: "learner",
    text: "Theirs",
    userId: other.userId,
  });
  await f.owner.mutation(remove, { id: mine });
  await other.owner.mutation(remove, { id: theirs });
  await f.t.mutation((ctx) =>
    ctx.db.patch(userId, createDeletedUserTombstone(userId, now))
  );
  const owners = async () => Arr.map(await f.restores(), (row) => row.userId);
  expect(await owners()).toEqual([userId, other.userId]);
  await expect(
    f.t.mutation(internal.auth.cleanup.cleanupDeletedUser, { userId })
  ).resolves.toBe(true);
  expect(await owners()).toEqual([other.userId]);
  while (
    await f.t.mutation(internal.auth.cleanup.cleanupDeletedUser, { userId })
  ) {
    // Each pass deletes one batch of what is left.
  }
  expect(await owners()).toEqual([other.userId]);
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(await f.restores()).toEqual([]);
});

it("deletes both directions of comment votes before their owning comment while keeping shared counters accurate", async () => {
  const { t, owner, retained } = await createDeletedOwner("votes");
  const seeded = await t.mutation(async (ctx) => {
    const ownComment = await ctx.db.insert("comments", {
      userId: owner,
      slug: "material/algebra",
      text: "Removed comment",
      upvoteCount: 1,
      downvoteCount: 0,
      replyCount: 0,
    });
    const sharedComment = await ctx.db.insert("comments", {
      userId: retained,
      slug: "material/algebra",
      text: "Retained comment",
      upvoteCount: 1,
      downvoteCount: 0,
      replyCount: 0,
    });
    const ownVote = await ctx.db.insert("commentVotes", {
      userId: owner,
      commentId: sharedComment,
      vote: 1,
    });
    const sharedVote = await ctx.db.insert("commentVotes", {
      userId: retained,
      commentId: ownComment,
      vote: 1,
    });
    return { ownComment, sharedComment, ownVote, sharedVote };
  });
  const cleanup = () =>
    t.mutation(internal.auth.cleanup.cleanupDeletedUser, { userId: owner });
  const read = () =>
    t.query(async (ctx) => ({
      ownComment: await ctx.db.get(seeded.ownComment),
      sharedComment: await ctx.db.get(seeded.sharedComment),
      ownVote: await ctx.db.get(seeded.ownVote),
      sharedVote: await ctx.db.get(seeded.sharedVote),
    }));
  await expect(cleanup()).resolves.toBe(true);
  expect(await read()).toMatchObject({
    ownVote: null,
    sharedComment: { upvoteCount: 0 },
    ownComment: { upvoteCount: 1 },
    sharedVote: { userId: retained },
  });
  await expect(cleanup()).resolves.toBe(true);
  expect(await read()).toMatchObject({
    sharedVote: null,
    ownComment: { upvoteCount: 0 },
  });
  await expect(cleanup()).resolves.toBe(true);
  expect(await read()).toMatchObject({
    ownComment: null,
    sharedComment: { userId: retained, upvoteCount: 0 },
    ownVote: null,
    sharedVote: null,
  });
  await expect(cleanup()).resolves.toBe(false);
  await t.finishAllScheduledFunctions(vi.runAllTimers);
});

it("removes the learner's likes on other posts with their counts, deletes the learner's posts with the likes others left, and keeps the rest", async () => {
  const { t, owner, retained } = await createDeletedOwner("posts");
  const seeded = await t.mutation(async (ctx) => {
    const ownPost = await ctx.db.insert("posts", {
      authorId: owner,
      likeCount: 1,
      text: "Removed post",
    });
    const sharedPost = await ctx.db.insert("posts", {
      authorId: retained,
      likeCount: 2,
      text: "Retained post",
    });
    // A like on a post that is already gone must not stop the cleanup.
    const gonePost = await ctx.db.insert("posts", {
      authorId: retained,
      likeCount: 0,
      text: "Gone post",
    });
    await ctx.db.delete(gonePost);
    await ctx.db.insert("postLikes", { postId: ownPost, userId: retained });
    await ctx.db.insert("postLikes", { postId: sharedPost, userId: owner });
    await ctx.db.insert("postLikes", { postId: sharedPost, userId: retained });
    await ctx.db.insert("postLikes", { postId: gonePost, userId: owner });
    return { gonePost, ownPost, sharedPost };
  });
  const cleanup = () =>
    t.mutation(internal.auth.cleanup.cleanupDeletedUser, { userId: owner });
  while (await cleanup()) {
    // Each pass deletes one batch of what is left.
  }
  expect(
    await t.query(async (ctx) => ({
      likes: await ctx.db.query("postLikes").collect(),
      ownPost: await ctx.db.get(seeded.ownPost),
      sharedPost: await ctx.db.get(seeded.sharedPost),
    }))
  ).toEqual({
    likes: [
      expect.objectContaining({ postId: seeded.sharedPost, userId: retained }),
    ],
    ownPost: null,
    sharedPost: expect.objectContaining({ likeCount: 1 }),
  });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
});

it("removes the learner's likes on comments with their counts, and keeps the rest", async () => {
  const { t, owner, retained } = await createDeletedOwner("comment-likes");
  const seeded = await t.mutation(async (ctx) => {
    const sharedComment = await ctx.db.insert("comments", {
      likeCount: 2,
      replyCount: 0,
      slug: "material/algebra",
      text: "Shared comment",
      upvoteCount: 0,
      downvoteCount: 0,
      userId: retained,
    });
    // A like on a comment that is already gone must not stop the cleanup.
    const goneComment = await ctx.db.insert("comments", {
      likeCount: 0,
      replyCount: 0,
      slug: "material/algebra",
      text: "Gone comment",
      upvoteCount: 0,
      downvoteCount: 0,
      userId: retained,
    });
    await ctx.db.delete(goneComment);
    await ctx.db.insert("commentLikes", {
      commentId: sharedComment,
      userId: owner,
    });
    await ctx.db.insert("commentLikes", {
      commentId: goneComment,
      userId: owner,
    });
    await ctx.db.insert("commentLikes", {
      commentId: sharedComment,
      userId: retained,
    });
    return { sharedComment };
  });
  const cleanup = () =>
    t.mutation(internal.auth.cleanup.cleanupDeletedUser, { userId: owner });
  while (await cleanup()) {
    // Each pass deletes one batch of what is left.
  }
  expect(
    await t.query(async (ctx) => ({
      likes: await ctx.db.query("commentLikes").collect(),
      comment: await ctx.db.get(seeded.sharedComment),
    }))
  ).toEqual({
    likes: [
      expect.objectContaining({
        commentId: seeded.sharedComment,
        userId: retained,
      }),
    ],
    comment: expect.objectContaining({ likeCount: 1 }),
  });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
});

it("deletes the likes a learner's post collected a batch at a time, and deletes the post after the last of them", async () => {
  const { t, owner, retained } = await createDeletedOwner("post-batches");
  const others = POST_LIKE_CLEANUP_BATCH_SIZE + 1;
  const postId = await t.mutation(async (ctx) => {
    const id = await ctx.db.insert("posts", {
      authorId: owner,
      likeCount: others,
      text: "Liked a lot",
    });
    for (let index = 0; index < others; index += 1) {
      await ctx.db.insert("postLikes", { postId: id, userId: retained });
    }
    return id;
  });
  const cleanup = () =>
    t.mutation(internal.auth.cleanup.cleanupDeletedUser, { userId: owner });
  const likes = () =>
    t
      .query((ctx) => ctx.db.query("postLikes").collect())
      .then((rows) => rows.length);
  await expect(cleanup()).resolves.toBe(true);
  expect(await likes()).toBe(1);
  expect(await t.query((ctx) => ctx.db.get("posts", postId))).not.toBeNull();
  while (await cleanup()) {
    // Each pass deletes one batch of what is left.
  }
  expect(await likes()).toBe(0);
  expect(await t.query((ctx) => ctx.db.get("posts", postId))).toBeNull();
  await t.finishAllScheduledFunctions(vi.runAllTimers);
});
