import { afterEach, expect, it } from "@effect/vitest";
import { MEMORY_BATCH_SIZE } from "@repo/backend/confect/auth/cleanup/social";
import { createDeletedUserTombstone } from "@repo/backend/confect/auth/deletion/tombstone";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { internal } from "@repo/backend/convex/_generated/api";
import { insertChat, insertMemory } from "@repo/backend/test/nina/memory";

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

it("deletes the learner's Nina memories with their sources, a batch at a time, and keeps another learner's", async () => {
  const owners = await createOwners("memory");
  const { t, owner, retained } = owners;
  const left = 5;
  const ownChat = await t.mutation((ctx) => insertChat(ctx, owner));
  const keptChat = await t.mutation((ctx) => insertChat(ctx, retained));
  await t.mutation(async (ctx) => {
    for (let index = 0; index < MEMORY_BATCH_SIZE + left; index += 1) {
      await insertMemory(ctx, {
        author: index % 2 === 0 ? "nina" : "learner",
        chats: [ownChat],
        text: `Memory ${index}`,
        userId: owner,
      });
    }
    await insertMemory(ctx, { chats: [keptChat], userId: retained });
  });
  // The memories exist before the account is deleted: a deleted account gets
  // no new key, so nothing can be sealed for it afterwards.
  await deleteOwner(owners);
  const state = () =>
    t.query(async (ctx) => ({
      memories: await ctx.db.query("ninaMemories").collect(),
      sources: await ctx.db.query("ninaMemorySources").collect(),
    }));
  const cleanup = () =>
    t.mutation(internal.auth.cleanup.cleanupDeletedUser, { userId: owner });
  await expect(cleanup()).resolves.toBe(true);
  const batch = await state();
  expect(batch.memories).toHaveLength(left + 1);
  expect(batch.sources).toHaveLength(left + 1);
  await expect(cleanup()).resolves.toBe(true);
  const emptied = await state();
  expect(emptied.memories).toEqual([
    expect.objectContaining({ userId: retained }),
  ]);
  expect(emptied.sources).toEqual([
    expect.objectContaining({ chatId: keptChat, userId: retained }),
  ]);
  // The learner's chat goes next, with no source left for it to forget, and
  // the learner's key goes after every row it sealed.
  while (await cleanup()) {
    await t.finishAllScheduledFunctions(vi.runAllTimers);
  }
  expect(await state()).toEqual(emptied);
  expect(await t.query((ctx) => ctx.db.get("chats", ownChat))).toBeNull();
  expect(await t.query((ctx) => ctx.db.query("vaultKeys").collect())).toEqual([
    expect.objectContaining({ userId: retained }),
  ]);
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
