import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";
import { readShareToken, shareLink } from "@/components/ai/chat/link";

const chatId = Schema.decodeUnknownSync(Id("chats"))("chat-1");
/** 43 URL-safe characters, the shape of a share token. */
const token = "abcdefghijklmnopqrstuvwxyz0123456789-_ABCDE";

describe("chat share link", () => {
  it("carries the token in the fragment, so the path alone is the chat id", () => {
    const link = new URL(shareLink(chatId, token));
    expect(link.pathname).toBe("/chat/chat-1");
    expect(link.search).toBe("");
    expect(link.hash).toBe(`#share=${token}`);
  });

  it("reads back the token that a link carries", () => {
    expect(readShareToken(new URL(shareLink(chatId, token)).hash)).toBe(token);
    expect(readShareToken(`#other=1&share=${token}`)).toBe(token);
  });

  it("reads none from a fragment that holds no token or one that cannot be a token", () => {
    expect(readShareToken("")).toBeUndefined();
    expect(readShareToken("#")).toBeUndefined();
    expect(readShareToken("#heading")).toBeUndefined();
    expect(readShareToken("#share=")).toBeUndefined();
    expect(readShareToken("#share=short")).toBeUndefined();
    expect(readShareToken(`#share=${token}extra`)).toBeUndefined();
  });
});
