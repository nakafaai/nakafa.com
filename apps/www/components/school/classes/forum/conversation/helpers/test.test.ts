import { describe, expect, it } from "vitest";
import {
  createConversationTestFindItemIndex,
  createConversationTestForum,
  createConversationTestHandle,
  createConversationTestPost,
} from "@/components/school/classes/forum/conversation/helpers/test";

describe("conversation/helpers/test", () => {
  it("builds readable post and forum fixtures", () => {
    const post = createConversationTestPost({
      postId: "post_1",
      sequence: 1,
    });
    const forum = createConversationTestForum();

    expect(post._id).toBe("post_1");
    expect(post.forumId).toBe(forum._id);
    expect(forum.postCount).toBe(3);
  });

  it("creates one configurable virtualizer handle with callable scroll spies", () => {
    const handle = createConversationTestHandle({
      scrollOffset: 120,
    });

    expect(handle.handle.getItemOffset(3)).toBe(300);
    expect(handle.handle.getItemSize(3)).toBe(100);
    expect(handle.handle.findItemIndex(450)).toBe(4);

    handle.handle.scrollTo(240);
    handle.handle.scrollBy(40);
    handle.handle.scrollToIndex(6);

    expect(handle.scrollTo).toHaveBeenCalledWith(240);
    expect(handle.scrollBy).toHaveBeenCalledWith(40);
    expect(handle.scrollToIndex).toHaveBeenCalledWith(6);
  });

  it("creates deterministic item-index lookup from item offsets", () => {
    const findItemIndex = createConversationTestFindItemIndex([
      0, 60, 120, 220,
    ]);

    expect(findItemIndex(-20)).toBe(0);
    expect(findItemIndex(0)).toBe(0);
    expect(findItemIndex(119)).toBe(1);
    expect(findItemIndex(220)).toBe(3);
    expect(findItemIndex(400)).toBe(3);
  });
});
