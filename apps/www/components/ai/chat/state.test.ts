import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import type { ChatView } from "@repo/backend/confect/chats/view";
import { Schema } from "effect";
import {
  patchChatPage,
  removeChatFromPage,
  updateOwnChatVisibility,
} from "@/components/ai/chat/state";

const firstId = Schema.decodeUnknownSync(Id("chats"))("chat-1");
const secondId = Schema.decodeUnknownSync(Id("chats"))("chat-2");
const userId = Schema.decodeUnknownSync(Id("users"))("user-1");
const page = [
  {
    _creationTime: 1,
    _id: firstId,
    threadId: "thread-1",
    title: "First",
    type: "study",
    updatedAt: 1,
    userId,
    visibility: "private",
  },
  {
    _creationTime: 2,
    _id: secondId,
    threadId: "thread-2",
    title: "Second",
    type: "study",
    updatedAt: 2,
    userId,
    visibility: "public",
  },
] satisfies ChatView[];

describe("chat query state", () => {
  it("patches only the matching chat", () => {
    const result = patchChatPage(page, firstId, { title: "Renamed" });

    expect(result[0].title).toBe("Renamed");
    expect(result[1]).toBe(page[1]);
    expect(page[0].title).toBe("First");
  });

  it("removes only the matching chat", () => {
    expect(removeChatFromPage(page, firstId)).toEqual([page[1]]);
  });

  it("patches visibility in an unfiltered own-chat page", () => {
    expect(updateOwnChatVisibility(page, firstId, "public")[0].visibility).toBe(
      "public"
    );
  });

  it("patches visibility when it still matches the selected scope", () => {
    expect(
      updateOwnChatVisibility(page, secondId, "public", "public")[1].visibility
    ).toBe("public");
  });

  it("removes a chat that leaves the selected visibility scope", () => {
    expect(updateOwnChatVisibility(page, firstId, "public", "private")).toEqual(
      [page[1]]
    );
  });
});
