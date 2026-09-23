import { beforeEach, describe, expect, it } from "@effect/vitest";
import posthogTest from "@posthog/convex/test";
import { api, internal } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { CHAT_TRANSCRIPT_REWRITE_MESSAGE_BATCH_SIZE } from "@repo/backend/convex/chats/constants";
import schema from "@repo/backend/convex/schema";
import {
  createConvexTestWithBetterAuth,
  seedAnalyticsConsent,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";

const NOW = Date.UTC(2026, 3, 2, 12, 0, 0);

/** Inserts generated tail messages used to exercise bounded transcript rewrites. */
async function insertGeneratedTailMessages(
  ctx: MutationCtx,
  chatId: Id<"chats">,
  count: number
) {
  for (let index = 0; index < count; index += 1) {
    await ctx.db.insert("messages", {
      chatId,
      identifier: `assistant-tail-${index}`,
      modelId: "nakafa-lite",
      role: "assistant",
    });
  }
}

describe("chats/mutations", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date(NOW));
  });

  it("does not capture messages inserted for a prepared account", async () => {
    const t = convexTest(schema, convexModules);
    posthogTest.register(t);

    const userId = await t.mutation(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        authId: "deleted-message-trigger-user",
        credits: 0,
        creditsResetAt: NOW,
        deletionPreparedAt: NOW,
        email: "deleted-message-trigger-user@example.com",
        name: "Deleted Trigger User",
        plan: "free",
      });
      const chatId = await ctx.db.insert("chats", {
        title: "Deleted trigger",
        type: "study",
        updatedAt: NOW,
        userId,
        visibility: "private",
      });
      await ctx.db.insert("messages", {
        chatId,
        identifier: "late-direct-message",
        modelId: "nakafa-lite",
        role: "assistant",
      });

      return userId;
    });
    const state = await t.query(async (ctx) => ({
      scheduledJobs: await ctx.db.system
        .query("_scheduled_functions")
        .collect(),
      user: await ctx.db.get("users", userId),
    }));

    expect(state.scheduledJobs).toEqual([]);
    expect(state.user?.deletionPreparedAt).toBe(NOW);
  });

  it("rejects authenticated writes while account deletion is prepared", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(
      async (ctx) =>
        await seedAuthenticatedUser(ctx, {
          now: NOW,
          suffix: "deleting-authenticated-user",
        })
    );
    await t.mutation(
      async (ctx) =>
        await ctx.db.patch("users", identity.userId, {
          deletionPreparedAt: NOW,
        })
    );

    await expect(
      t
        .withIdentity({
          sessionId: identity.sessionId,
          subject: identity.authUserId,
        })
        .mutation(api.chats.mutations.createChat, {
          type: "study",
        })
    ).rejects.toMatchObject({
      data: {
        code: "UNAUTHORIZED",
        message: "User not found.",
      },
    });
  });

  it("captures a user chat message with the selected model", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const seeded = await seedAuthenticatedUser(ctx, { now: NOW });
      await seedAnalyticsConsent(ctx, {
        decidedAt: NOW,
        userId: seeded.userId,
      });
      return seeded;
    });

    const result = await t
      .withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      })
      .mutation(api.chats.mutations.createChatWithMessage, {
        type: "study",
        message: {
          role: "user",
          identifier: "user-1",
          modelId: "nakafa-lite",
        },
        parts: [],
      });

    const scheduledJobs = await t.query(
      async (ctx) => await ctx.db.system.query("_scheduled_functions").collect()
    );

    expect(result.chatId).toBeDefined();
    expect(scheduledJobs).toEqual([
      expect.objectContaining({
        args: [
          expect.objectContaining({
            disableGeoip: true,
            distinctId: identity.userId,
            event: "chat message sent",
            properties: JSON.stringify({
              chat_type: "study",
              model_id: "nakafa-lite",
            }),
          }),
        ],
        name: expect.stringContaining("capture"),
      }),
    ]);
  });

  it("atomically replaces an existing user message and its generated tail", async () => {
    const t = createConvexTestWithBetterAuth();
    posthogTest.register(t);
    const identity = await t.mutation(
      async (ctx) =>
        await seedAuthenticatedUser(ctx, {
          now: NOW,
          suffix: "rewrite-owner",
        })
    );
    const owner = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });
    const { chatId } = await owner.mutation(
      api.chats.mutations.createChatWithMessage,
      {
        type: "study",
        message: {
          role: "user",
          identifier: "user-rewrite",
          modelId: "nakafa-lite",
        },
        parts: [],
      }
    );

    const turnId = await owner.mutation(api.chats.turns.mutations.reserve, {
      modelId: "nakafa-lite",
    });
    await t.mutation(internal.chats.assistantResponses.saveAssistantResponse, {
      userId: identity.userId,
      turnId,
      message: {
        chatId,
        role: "assistant",
        identifier: "assistant-tail",
        modelId: "nakafa-lite",
      },
      parts: [],
    });

    const replacement = await owner.mutation(api.chats.mutations.saveMessage, {
      message: {
        chatId,
        role: "user",
        identifier: "user-rewrite",
        modelId: "nakafa-lite",
      },
      parts: [],
    });
    const messages = await t.query(
      async (ctx) =>
        await ctx.db
          .query("messages")
          .withIndex("by_chatId", (q) => q.eq("chatId", chatId))
          .collect()
    );

    expect(messages).toEqual([
      expect.objectContaining({
        _id: replacement.messageId,
        chatId,
        identifier: "user-rewrite",
        role: "user",
      }),
    ]);
  });

  it.each([
    CHAT_TRANSCRIPT_REWRITE_MESSAGE_BATCH_SIZE - 1,
    CHAT_TRANSCRIPT_REWRITE_MESSAGE_BATCH_SIZE,
  ])(
    "keeps transcript rewrites atomic with %s tail messages",
    async (tailCount) => {
      const t = createConvexTestWithBetterAuth();
      posthogTest.register(t);
      const identity = await t.mutation(
        async (ctx) =>
          await seedAuthenticatedUser(ctx, {
            now: NOW,
            suffix: "exact-rewrite-owner",
          })
      );
      const owner = t.withIdentity({
        sessionId: identity.sessionId,
        subject: identity.authUserId,
      });
      const { chatId } = await owner.mutation(
        api.chats.mutations.createChatWithMessage,
        {
          type: "study",
          message: {
            role: "user",
            identifier: "user-rewrite-exact",
            modelId: "nakafa-lite",
          },
          parts: [],
        }
      );

      await t.mutation(
        async (ctx) => await insertGeneratedTailMessages(ctx, chatId, tailCount)
      );

      if (tailCount === CHAT_TRANSCRIPT_REWRITE_MESSAGE_BATCH_SIZE) {
        await expect(
          owner.mutation(api.chats.mutations.saveMessage, {
            message: {
              chatId,
              role: "user",
              identifier: "user-rewrite-exact",
              modelId: "nakafa-lite",
            },
            parts: [],
          })
        ).rejects.toMatchObject({
          data: { code: "CHAT_USER_MESSAGE_REWRITE_EXCEEDED" },
        });
        expect(
          await t.query((ctx) => ctx.db.query("messages").collect())
        ).toHaveLength(tailCount + 1);
        return;
      }
      const replacement = await owner.mutation(
        api.chats.mutations.saveMessage,
        {
          message: {
            chatId,
            role: "user",
            identifier: "user-rewrite-exact",
            modelId: "nakafa-lite",
          },
          parts: [],
        }
      );
      const messages = await t.query(
        async (ctx) =>
          await ctx.db
            .query("messages")
            .withIndex("by_chatId", (q) => q.eq("chatId", chatId))
            .collect()
      );

      expect(messages).toEqual([
        expect.objectContaining({
          _id: replacement.messageId,
          chatId,
          identifier: "user-rewrite-exact",
          role: "user",
        }),
      ]);
    }
  );
});

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
  const chatId = await owner.mutation(api.chats.mutations.createChat, {
    type: "study",
  });
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

it("appends a new message without removing existing transcript rows", async () => {
  const t = createConvexTestWithBetterAuth();
  const identity = await t.mutation((ctx) =>
    seedAuthenticatedUser(ctx, { now: NOW, suffix: "append" })
  );
  const owner = t.withIdentity({
    subject: identity.authUserId,
    sessionId: identity.sessionId,
  });
  const chatId = await owner.mutation(api.chats.mutations.createChat, {
    type: "study",
  });
  for (const identifier of ["first", "second"]) {
    await owner.mutation(api.chats.mutations.saveMessage, {
      message: { chatId, identifier, role: "user" },
      parts: [],
    });
  }
  expect(
    await t.query((ctx) => ctx.db.query("messages").collect())
  ).toMatchObject([{ identifier: "first" }, { identifier: "second" }]);
});
