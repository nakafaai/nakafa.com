import { Ref } from "@confect/core";
import { createThread } from "@convex-dev/agent";
import { expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { api } from "@repo/backend/convex/_generated/api";
import { showsText } from "@repo/backend/test/seal";

const NOW = Date.UTC(2026, 3, 2, 12);
const getShareToken = Ref.getFunctionReference(
  refs.public.chats.queries.getShareToken
);

it("enforces chat ownership for title, visibility, and deletion mutations", async () => {
  const t = createConvexTestWithBetterAuth();
  const [identity, outsider] = await t.mutation(async (ctx) =>
    Promise.all([
      seedAuthenticatedUser(ctx, { now: NOW, suffix: "chat-owner" }),
      seedAuthenticatedUser(ctx, { now: NOW, suffix: "chat-outsider" }),
    ])
  );
  const owner = t.withIdentity({
    subject: identity.authUserId,
    sessionId: identity.sessionId,
  });
  const stranger = t.withIdentity({
    subject: outsider.authUserId,
    sessionId: outsider.sessionId,
  });
  const chatId = await t.mutation(async (ctx) =>
    ctx.db.insert("chats", {
      threadId: await createThread(ctx, components.nina, {
        userId: identity.userId,
      }),
      userId: identity.userId,
      type: "study",
      visibility: "private",
      updatedAt: NOW,
    })
  );
  for (const client of [stranger, owner]) {
    const writes = [
      () =>
        client.mutation(api.chats.mutations.updateChatTitle, {
          chatId,
          title: "Updated",
        }),
      () =>
        client.mutation(api.chats.mutations.updateChatVisibility, {
          chatId,
          visibility: "public",
        }),
      () => client.mutation(api.chats.mutations.deleteChat, { chatId }),
    ];
    for (const write of writes) {
      if (client === stranger) {
        await expect(write()).rejects.toMatchObject({
          data: { code: "FORBIDDEN" },
        });
      } else {
        await write();
      }
    }
  }
  for (const write of [
    () =>
      owner.mutation(api.chats.mutations.updateChatTitle, {
        chatId,
        title: "Missing",
      }),
    () =>
      owner.mutation(api.chats.mutations.updateChatVisibility, {
        chatId,
        visibility: "private",
      }),
    () => owner.mutation(api.chats.mutations.deleteChat, { chatId }),
  ]) {
    await expect(write()).rejects.toMatchObject({
      data: { code: "CHAT_NOT_FOUND" },
    });
  }
});

it("trims a renamed title, and refuses one that is empty or longer than 80 characters before it writes anything", async () => {
  const t = createConvexTestWithBetterAuth();
  const identity = await t.mutation((ctx) =>
    seedAuthenticatedUser(ctx, { now: NOW, suffix: "chat-rename-bound" })
  );
  const owner = t.withIdentity({
    subject: identity.authUserId,
    sessionId: identity.sessionId,
  });
  const chatId = await t.mutation((ctx) =>
    ctx.db.insert("chats", {
      threadId: "fixture-thread",
      type: "study",
      updatedAt: NOW,
      userId: identity.userId,
      visibility: "private",
    })
  );
  const rename = (title: string) =>
    owner.mutation(api.chats.mutations.updateChatTitle, { chatId, title });

  await expect(rename("x".repeat(81))).rejects.toThrow();
  await expect(rename("   ")).rejects.toThrow();
  expect(
    (await t.query((ctx) => ctx.db.get("chats", chatId)))?.title
  ).toBeUndefined();

  await rename(`  ${"x".repeat(80)}  `);
  expect(
    await owner.query(api.chats.queries.getChat, { chatId })
  ).toMatchObject({ title: "x".repeat(80) });
});

it("stores a renamed title sealed and reads it back as the new title", async () => {
  const t = createConvexTestWithBetterAuth();
  const identity = await t.mutation((ctx) =>
    seedAuthenticatedUser(ctx, { now: NOW, suffix: "chat-rename" })
  );
  const owner = t.withIdentity({
    subject: identity.authUserId,
    sessionId: identity.sessionId,
  });
  const chatId = await t.mutation((ctx) =>
    ctx.db.insert("chats", {
      threadId: "fixture-thread",
      type: "study",
      updatedAt: NOW,
      userId: identity.userId,
      visibility: "private",
    })
  );
  const storedTitle = async () =>
    (await t.query((ctx) => ctx.db.get("chats", chatId)))?.title;
  expect(await storedTitle()).toBeUndefined();
  for (const title of ["Pecahan dan desimal", "Persamaan kuadrat"]) {
    await owner.mutation(api.chats.mutations.updateChatTitle, {
      chatId,
      title,
    });
    expect(await storedTitle()).toBeInstanceOf(ArrayBuffer);
    expect(showsText(await storedTitle(), title)).toBe(false);
    expect(
      await owner.query(api.chats.queries.getChat, { chatId })
    ).toMatchObject({ title });
  }
});

it("draws a token when a chat is shared, keeps it while the chat stays shared, and deletes it when sharing stops", async () => {
  const t = createConvexTestWithBetterAuth();
  const identity = await t.mutation((ctx) =>
    seedAuthenticatedUser(ctx, { now: NOW, suffix: "chat-share" })
  );
  const owner = t.withIdentity({
    subject: identity.authUserId,
    sessionId: identity.sessionId,
  });
  const chatId = await t.mutation((ctx) =>
    ctx.db.insert("chats", {
      threadId: "fixture-thread",
      type: "study",
      updatedAt: NOW,
      userId: identity.userId,
      visibility: "private",
    })
  );
  const visibility = async () =>
    (await t.query((ctx) => ctx.db.get("chats", chatId)))?.visibility;
  const shares = () => t.query((ctx) => ctx.db.query("chatShares").collect());
  const share = (next: "private" | "public") =>
    owner.mutation(api.chats.mutations.updateChatVisibility, {
      chatId,
      visibility: next,
    });
  const token = () => owner.query(getShareToken, { chatId });

  expect(await shares()).toEqual([]);
  await share("public");
  expect(await visibility()).toBe("public");
  const first = await token();
  expect(first).not.toBeNull();
  expect(await shares()).toHaveLength(1);

  // Asking again keeps the link that was given out.
  await share("public");
  expect(await token()).toBe(first);
  expect(await shares()).toHaveLength(1);

  await share("private");
  expect(await visibility()).toBe("private");
  expect(await shares()).toEqual([]);
  expect(await token()).toBeNull();

  // Stopping a chat that is not shared changes nothing.
  await share("private");
  expect(await shares()).toEqual([]);

  await share("public");
  expect(await token()).not.toBe(first);
  expect(await shares()).toHaveLength(1);
});

it("gives a link to a chat that was public before share tokens when its owner shares it again", async () => {
  const t = createConvexTestWithBetterAuth();
  const identity = await t.mutation((ctx) =>
    seedAuthenticatedUser(ctx, { now: NOW, suffix: "chat-legacy" })
  );
  const owner = t.withIdentity({
    subject: identity.authUserId,
    sessionId: identity.sessionId,
  });
  const chatId = await t.mutation((ctx) =>
    ctx.db.insert("chats", {
      threadId: "fixture-thread",
      type: "study",
      updatedAt: NOW,
      userId: identity.userId,
      visibility: "public",
    })
  );
  expect(await owner.query(getShareToken, { chatId })).toBeNull();
  await owner.mutation(api.chats.mutations.updateChatVisibility, {
    chatId,
    visibility: "public",
  });
  const token = await owner.query(getShareToken, { chatId });
  expect(token).not.toBeNull();
  expect(
    await t.query((ctx) => ctx.db.query("chatShares").collect())
  ).toHaveLength(1);
});
