import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { describe, expect, it } from "vitest";
import { getConversationRestorePlacement } from "@/components/school/classes/forum/conversation/data/scroll/restore";

const postId = "post_1" as Id<"schoolClassForumPosts">;

describe("conversation/data/scroll/restore", () => {
  it("returns no pending operation without an initial restore target", () => {
    expect(getConversationRestorePlacement(null)).toEqual({ kind: "none" });
  });

  it("keeps saved offsets as offset restore operations", () => {
    expect(
      getConversationRestorePlacement({
        kind: "offset",
        offset: 120,
      })
    ).toEqual({
      kind: "offset",
      offset: 120,
    });
  });

  it("converts post targets to reached pending placements", () => {
    expect(
      getConversationRestorePlacement({
        align: "center",
        kind: "post",
        postId,
      })
    ).toEqual({
      kind: "placement",
      placement: {
        align: "center",
        behavior: "auto",
        completion: "reached",
        highlightPostId: null,
        view: {
          kind: "post",
          postId,
        },
      },
    });
  });

  it("converts bottom targets to reached pending placements", () => {
    expect(getConversationRestorePlacement({ kind: "bottom" })).toEqual({
      kind: "placement",
      placement: {
        behavior: "auto",
        completion: "reached",
        highlightPostId: null,
        view: { kind: "bottom" },
      },
    });
  });
});
