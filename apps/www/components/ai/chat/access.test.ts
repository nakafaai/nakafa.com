import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import {
  AccountUnavailable,
  AuthReadError,
  SessionRequired,
} from "@repo/backend/confect/auth/spec";
import { ChatAccessError } from "@repo/backend/confect/chats/access/spec";
import { Schema } from "effect";
import {
  readChatAccess,
  readChatArgs,
  readChatFailureKind,
} from "@/components/ai/chat/access";

const learner = Schema.decodeUnknownSync(Id("users"))("user_1");
const stranger = Schema.decodeUnknownSync(Id("users"))("user_2");
const chatId = Schema.decodeUnknownSync(Id("chats"))("chat_1");
/** 43 URL-safe characters, the shape of a share token. */
const token = "abcdefghijklmnopqrstuvwxyz0123456789-_ABCDE";

const loaded = {
  chatUserId: learner,
  loading: false,
  opening: false,
  viewerId: learner,
};

describe("chat/access", () => {
  it("lets the owner of a loaded chat write", () => {
    expect(readChatAccess(loaded)).toEqual({ canWrite: true, owner: true });
  });

  it("gives anyone else a chat to read and nothing to write", () => {
    expect(readChatAccess({ ...loaded, viewerId: stranger })).toEqual({
      canWrite: false,
      owner: false,
    });
  });

  it("gives a signed-in viewer nothing to write to a loaded chat that names no owner, which is how a reader receives a chat", () => {
    expect(
      readChatAccess({ ...loaded, chatUserId: undefined, viewerId: learner })
    ).toEqual({ canWrite: false, owner: false });
  });

  it("gives a signed-out viewer nothing to write, even to a chat with no owner yet", () => {
    expect(readChatAccess({ ...loaded, viewerId: undefined })).toEqual({
      canWrite: false,
      owner: false,
    });
    expect(
      readChatAccess({
        chatUserId: undefined,
        loading: true,
        opening: true,
        viewerId: undefined,
      })
    ).toEqual({ canWrite: false, owner: false });
  });

  it("lets the learner write to the chat they just started while it loads", () => {
    expect(
      readChatAccess({
        chatUserId: undefined,
        loading: true,
        opening: true,
        viewerId: learner,
      })
    ).toEqual({ canWrite: true, owner: false });
  });

  it("gives a chat that only loads, or that someone else owns, no write access", () => {
    expect(
      readChatAccess({
        chatUserId: undefined,
        loading: true,
        opening: false,
        viewerId: learner,
      })
    ).toEqual({ canWrite: false, owner: false });
    expect(
      readChatAccess({
        chatUserId: stranger,
        loading: false,
        opening: true,
        viewerId: learner,
      })
    ).toEqual({ canWrite: false, owner: false });
  });
});

describe("chat/access arguments", () => {
  it("reads the chat by its id when the reader holds no link", () => {
    // The key is absent, not undefined: the queries declare `shareToken` as an
    // optional key, which takes a string or nothing.
    expect(readChatArgs(chatId, undefined)).toStrictEqual({ chatId });
  });

  it("sends the share token of the link along with the chat id", () => {
    expect(readChatArgs(chatId, token)).toStrictEqual({
      chatId,
      shareToken: token,
    });
  });
});

describe("chat/access failure card", () => {
  it("reads each declared access failure as the chat not being available to the viewer", () => {
    expect(
      readChatFailureKind(
        new SessionRequired({
          code: "UNAUTHENTICATED",
          message: "Unauthenticated",
        })
      )
    ).toBe("access");
    expect(
      readChatFailureKind(
        new AccountUnavailable({
          code: "UNAUTHORIZED",
          message: "User not found.",
        })
      )
    ).toBe("access");
    expect(
      readChatFailureKind(
        new ChatAccessError({ code: "FORBIDDEN", message: "Not yours." })
      )
    ).toBe("access");
    expect(
      readChatFailureKind(
        new ChatAccessError({ code: "CHAT_NOT_FOUND", message: "Gone." })
      )
    ).toBe("access");
  });

  it("reads a declared failure of Nakafa's own as a failure to retry, never as access", () => {
    expect(
      readChatFailureKind(
        new AuthReadError({
          code: "AUTH_READ_FAILED",
          message: "Unable to read authentication state.",
        })
      )
    ).toBe("retry");
  });

  it("reads a defect as a failure to retry, whatever its text says", () => {
    expect(
      readChatFailureKind(new Error("You do not have access to this chat"))
    ).toBe("retry");
    expect(readChatFailureKind(undefined)).toBe("retry");
  });
});
