import { Ref } from "@confect/core";
import { afterEach, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { MEMORY_BATCH_SIZE } from "@repo/backend/confect/auth/cleanup/social";
import { createDeletedUserTombstone } from "@repo/backend/confect/auth/deletion/tombstone";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { internal } from "@repo/backend/convex/_generated/api";
import { createMemoryTest, insertMemory } from "@repo/backend/test/nina/memory";

const capture = Ref.getFunctionReference(refs.internal.nina.memory.capture);

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

it("deletes the learner's Nina memories a batch at a time, Nina's and the learner's own, and keeps another learner's", async () => {
  const owners = await createOwners("memory");
  const { t, owner, retained } = owners;
  const left = 5;
  await t.mutation(async (ctx) => {
    for (let index = 0; index < MEMORY_BATCH_SIZE + left; index += 1) {
      await insertMemory(ctx, {
        author: index % 2 === 0 ? "nina" : "learner",
        text: `Memory ${index}`,
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
  const cleanup = () =>
    t.mutation(internal.auth.cleanup.cleanupDeletedUser, { userId: owner });
  await expect(cleanup()).resolves.toBe(true);
  expect(await memories()).toHaveLength(left + 1);
  await expect(cleanup()).resolves.toBe(true);
  const emptied = await memories();
  expect(emptied).toEqual([expect.objectContaining({ userId: retained })]);
  // The learner's key goes after every row it sealed.
  while (await cleanup()) {
    await t.finishAllScheduledFunctions(vi.runAllTimers);
  }
  expect(await memories()).toEqual(emptied);
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
  // A capture that was still running lands between two passes, while the key
  // exists. The next pass deletes what it wrote, because every pass looks for
  // memories before the key goes.
  await expect(write()).resolves.toBe(1);
  let passes = 0;
  while (await cleanup()) {
    passes += 1;
  }
  expect(passes).toBeGreaterThan(0);
  expect(await f.stored()).toEqual([]);
  expect(await keys()).toEqual([]);
  // The turn is still there, but the key is gone and a deleted account gets no
  // new one, so a capture that lands now cannot seal anything.
  await expect(write()).rejects.toThrow();
  expect(await f.stored()).toEqual([]);
  expect(await keys()).toEqual([]);
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
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
