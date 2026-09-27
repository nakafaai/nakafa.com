import { Ref } from "@confect/core";
import { assert, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { ChatAccessError } from "@repo/backend/confect/chats/access/spec";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { api } from "@repo/backend/convex/_generated/api";
import { Option } from "effect";

describe("transcript read authorization", () => {
  it("protects private transcripts from anonymous and other accounts while permitting public sharing", async () => {
    const t = createConvexTestWithBetterAuth();
    const { owner, stranger, chatId } = await t.mutation(async (ctx) => {
      const owner = await seedAuthenticatedUser(ctx, {
        now: Date.now(),
        suffix: "read-owner",
      });
      const stranger = await seedAuthenticatedUser(ctx, {
        now: Date.now(),
        suffix: "read-stranger",
      });
      const chatId = await ctx.db.insert("chats", {
        threadId: "fixture-thread",
        userId: owner.userId,
        type: "study",
        visibility: "private",
        updatedAt: Date.now(),
      });
      return {
        owner,
        stranger,
        chatId,
      };
    });
    const strangerClient = t.withIdentity({
      subject: stranger.authUserId,
      sessionId: stranger.sessionId,
    });
    for (const viewer of [t, strangerClient]) {
      const failure = await viewer
        .query(api.chats.queries.getChat, { chatId })
        .catch((error: unknown) => error);
      assert(Ref.isConvexError(failure));
      expect(failure.data).toEqual({
        _tag: "ChatAccessError",
        code: "FORBIDDEN",
        message: "You do not have permission to access this private chat.",
      });
      const decoded = Ref.decodeErrorOption(
        refs.public.chats.queries.getChat,
        failure.data
      );
      assert(Option.isSome(decoded));
      expect(decoded.value).toBeInstanceOf(ChatAccessError);
    }
    const ownerClient = t.withIdentity({
      subject: owner.authUserId,
      sessionId: owner.sessionId,
    });
    expect(
      await ownerClient.query(api.chats.queries.getChat, {
        chatId,
      })
    ).toMatchObject({
      _id: chatId,
    });
    await ownerClient.mutation(api.chats.mutations.updateChatVisibility, {
      chatId,
      visibility: "public",
    });
    expect(
      await t.query(api.chats.queries.getChat, {
        chatId,
      })
    ).toMatchObject({
      _id: chatId,
      visibility: "public",
    });
  });
});
