import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import {
  type ChatView,
  chatViewValidator,
  readerChat,
} from "@repo/backend/confect/chats/view";
import { Schema } from "effect";

const owned = {
  _creationTime: 1,
  _id: Schema.decodeUnknownSync(Id("chats"))("chat_1"),
  activeTurnId: Schema.decodeUnknownSync(Id("ninaTurns"))("turn_1"),
  threadId: "thread_1",
  title: "A title",
  type: "study",
  updatedAt: 2,
  userId: Schema.decodeUnknownSync(Id("users"))("user_1"),
  visibility: "public",
} satisfies ChatView;

describe("chats/view", () => {
  it("leaves the owner's account and the running turn out of the chat a reader is told of", () => {
    expect(readerChat(owned)).toEqual({
      _creationTime: 1,
      _id: owned._id,
      threadId: "thread_1",
      title: "A title",
      type: "study",
      updatedAt: 2,
      visibility: "public",
    });
  });

  it("accepts a chat that names no owner, which is how a reader receives it", () => {
    const told = readerChat(owned);

    expect(Schema.decodeSync(chatViewValidator)(told)).toEqual(told);
  });
});
