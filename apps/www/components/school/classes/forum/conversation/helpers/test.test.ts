import { describe, expect, it } from "vitest";
import {
  createConversationTestForum,
  createConversationTestHandle,
  createConversationTestPost,
  createConversationTestRowsHandle,
} from "@/components/school/classes/forum/conversation/helpers/test";

describe("conversation/helpers/test", () => {
  it("creates default forum and post fixtures", () => {
    expect(createConversationTestForum().title).toBe("Forum");
    expect(
      createConversationTestPost({
        postId: "post_custom",
        sequence: 7,
      }).body
    ).toBe("post-7");
  });

  it("creates a virtualizer handle with deterministic default geometry", () => {
    const { handle } = createConversationTestHandle({
      scrollOffset: 250,
    });

    expect(handle.findItemIndex(250)).toBe(2);
    expect(handle.getItemOffset(3)).toBe(300);
    expect(handle.getItemSize(3)).toBe(100);
  });

  it("falls back to indexed offsets for row-backed handles", () => {
    const { handle } = createConversationTestRowsHandle({
      offsets: [0],
      scrollOffset: 0,
    });

    expect(handle.getItemOffset(2)).toBe(200);
  });
});
