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

const now = Date.UTC(2026, 8, 1);
const getChat = Ref.getFunctionReference(refs.public.chats.queries.getChat);
const getShareToken = Ref.getFunctionReference(
  refs.public.chats.queries.getShareToken
);
/** Well formed, and the token of no chat. */
const WRONG_TOKEN = "A".repeat(43);

/** What a read answers for a chat the reader cannot open. */
function notFound(chatId: string) {
  return {
    _tag: "ChatAccessError",
    code: "CHAT_NOT_FOUND",
    message: `Chat not found for chatId: ${chatId}`,
  };
}

/** The error data a refused read throws. */
async function refusal(read: Promise<unknown>) {
  const failure = await read.catch((error: unknown) => error);
  assert(Ref.isConvexError(failure));
  return failure.data;
}

/** One owner with a private chat, a shared chat and a deleted one, and a stranger. */
async function fixture() {
  const t = createConvexTestWithBetterAuth();
  const { owner, stranger, chatIds } = await t.mutation(async (ctx) => {
    const owner = await seedAuthenticatedUser(ctx, {
      now,
      suffix: "read-owner",
    });
    const stranger = await seedAuthenticatedUser(ctx, {
      now,
      suffix: "read-stranger",
    });
    const insert = () =>
      ctx.db.insert("chats", {
        threadId: "fixture-thread",
        userId: owner.userId,
        type: "study",
        visibility: "private",
        updatedAt: now,
      });
    const gone = await insert();
    await ctx.db.delete("chats", gone);
    return {
      owner,
      stranger,
      chatIds: { gone, private: await insert(), shared: await insert() },
    };
  });
  const asOwner = t.withIdentity({
    subject: owner.authUserId,
    sessionId: owner.sessionId,
  });
  const asStranger = t.withIdentity({
    subject: stranger.authUserId,
    sessionId: stranger.sessionId,
  });
  const share = (visibility: "private" | "public") =>
    asOwner.mutation(api.chats.mutations.updateChatVisibility, {
      chatId: chatIds.shared,
      visibility,
    });
  const token = async () => {
    const stored = await asOwner.query(getShareToken, {
      chatId: chatIds.shared,
    });
    assert(stored !== null);
    return stored;
  };
  await share("public");
  return { t, asOwner, asStranger, chatIds, share, token };
}

describe("transcript read authorization", () => {
  it("answers a chat id alone as if the chat did not exist, whether it is private, shared or gone", async () => {
    const { t, asStranger, chatIds } = await fixture();
    for (const viewer of [t, asStranger]) {
      for (const chatId of [chatIds.private, chatIds.shared, chatIds.gone]) {
        const failure = await refusal(viewer.query(getChat, { chatId }));
        expect(failure).toEqual(notFound(chatId));
        const decoded = Ref.decodeErrorOption(
          refs.public.chats.queries.getChat,
          failure
        );
        assert(Option.isSome(decoded));
        expect(decoded.value).toBeInstanceOf(ChatAccessError);
      }
    }
  });

  it("opens a shared chat for whoever holds its token and for its owner by id, and for no other token", async () => {
    const { t, asOwner, asStranger, chatIds, token } = await fixture();
    const chatId = chatIds.shared;
    const shareToken = await token();
    for (const viewer of [t, asStranger]) {
      expect(await viewer.query(getChat, { chatId, shareToken })).toMatchObject(
        { _id: chatId, visibility: "public" }
      );
      expect(
        await refusal(
          viewer.query(getChat, { chatId, shareToken: WRONG_TOKEN })
        )
      ).toEqual(notFound(chatId));
    }
    for (const owned of [{ chatId }, { chatId, shareToken: WRONG_TOKEN }]) {
      expect(await asOwner.query(getChat, owned)).toMatchObject({
        _id: chatId,
      });
    }
    // The token of one chat opens no other chat.
    expect(
      await refusal(t.query(getChat, { chatId: chatIds.private, shareToken }))
    ).toEqual(notFound(chatIds.private));
  });

  it("stops every link when sharing is turned off, and draws a new link when it is turned on again", async () => {
    const { t, asOwner, chatIds, share, token } = await fixture();
    const chatId = chatIds.shared;
    const first = await token();
    await share("private");
    expect(
      await refusal(t.query(getChat, { chatId, shareToken: first }))
    ).toEqual(notFound(chatId));
    expect(await asOwner.query(getShareToken, { chatId })).toBeNull();
    await share("public");
    const second = await token();
    expect(second).not.toBe(first);
    expect(
      await refusal(t.query(getChat, { chatId, shareToken: first }))
    ).toEqual(notFound(chatId));
    expect(
      await t.query(getChat, { chatId, shareToken: second })
    ).toMatchObject({ _id: chatId });
  });

  it("refuses a token that is not the shape of one before it reads a chat", async () => {
    const { t, chatIds } = await fixture();
    // The refusal names the argument that failed. Without the shape check the
    // read would go on and answer CHAT_NOT_FOUND, which names no argument.
    await expect(
      t.query(getChat, { chatId: chatIds.shared, shareToken: "short" })
    ).rejects.toThrow('["shareToken"]');
  });
});
