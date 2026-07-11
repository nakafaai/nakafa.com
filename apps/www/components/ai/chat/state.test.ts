import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import { describe, expect, it } from "vitest";
import {
  patchChatPage,
  removeChatFromPage,
  updateOwnChatVisibility,
} from "@/components/ai/chat/state";

const firstId = "chat-1" as Id<"chats">;
const secondId = "chat-2" as Id<"chats">;
const page = [
  {
    _creationTime: 1,
    _id: firstId,
    title: "First",
    type: "study",
    updatedAt: 1,
    userId: "user-1" as Id<"users">,
    visibility: "private",
  },
  {
    _creationTime: 2,
    _id: secondId,
    title: "Second",
    type: "study",
    updatedAt: 2,
    userId: "user-1" as Id<"users">,
    visibility: "public",
  },
] satisfies Doc<"chats">[];

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
