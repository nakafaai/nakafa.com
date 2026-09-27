import { afterEach, expect, it } from "@effect/vitest";
import { createDeletedUserTombstone } from "@repo/backend/confect/auth/deletion/tombstone";
import { CHAT_TRANSCRIPT_REWRITE_MESSAGE_BATCH_SIZE } from "@repo/backend/confect/chats/constants";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { internal } from "@repo/backend/convex/_generated/api";

afterEach(() => vi.useRealTimers());

async function createDeletedOwner(suffix: string) {
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
    await ctx.db.patch(
      owner.userId,
      createDeletedUserTombstone(owner.userId, now)
    );
    return { owner: owner.userId, retained: retained.userId };
  });
  return { t, now, ...users };
}

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

it("retains a chat until every bounded transcript page is removed", async () => {
  const { t, owner, retained, now } = await createDeletedOwner("transcript");
  const seeded = await t.mutation(async (ctx) => {
    const chatId = await ctx.db.insert("chats", {
      userId: owner,
      type: "study",
      visibility: "private",
      updatedAt: now,
    });
    const retainedChatId = await ctx.db.insert("chats", {
      userId: retained,
      type: "study",
      visibility: "private",
      updatedAt: now,
    });
    for (
      let index = 0;
      index <= CHAT_TRANSCRIPT_REWRITE_MESSAGE_BATCH_SIZE;
      index += 1
    ) {
      const messageId = await ctx.db.insert("messages", {
        chatId,
        role: "user",
        identifier: `message-${index}`,
      });
      await ctx.db.insert("messageParts", {
        messageId,
        order: 0,
        type: "text",
        textText: `Private question ${index}`,
      });
    }
    return { chatId, retainedChatId };
  });
  const cleanup = () =>
    t.mutation(internal.auth.cleanup.cleanupDeletedUser, { userId: owner });
  const read = () =>
    t.query(async (ctx) => ({
      chat: await ctx.db.get(seeded.chatId),
      retainedChat: await ctx.db.get(seeded.retainedChatId),
      messages: await ctx.db.query("messages").collect(),
      parts: await ctx.db.query("messageParts").collect(),
    }));
  await expect(cleanup()).resolves.toBe(true);
  const continued = await read();
  expect(continued.chat).not.toBeNull();
  expect(continued.messages).toHaveLength(1);
  expect(continued.parts).toHaveLength(1);
  await expect(cleanup()).resolves.toBe(true);
  expect(await read()).toMatchObject({
    chat: null,
    messages: [],
    parts: [],
    retainedChat: { userId: retained },
  });
  await expect(cleanup()).resolves.toBe(false);
  await t.finishAllScheduledFunctions(vi.runAllTimers);
});
