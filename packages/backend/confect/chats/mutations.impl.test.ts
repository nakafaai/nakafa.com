import { createThread } from "@convex-dev/agent";
import { expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { api } from "@repo/backend/convex/_generated/api";

const NOW = Date.UTC(2026, 3, 2, 12);

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
