import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import { focusComment, readFocusedComment } from "@/lib/comments/focus";

describe("the comment a page opens for its reader", () => {
  it("points an address at a comment, and reads it back from the search", () => {
    const address = focusComment(
      new URL("https://nakafa.com/id/artikel/contoh"),
      "comment-1"
    );

    expect(address).toBe("/id/artikel/contoh?comment=comment-1#comments");
    expect(readFocusedComment({ comment: "comment-1" })).toEqual(
      Option.some("comment-1")
    );
  });

  it("reads no comment from a search that names none", () => {
    expect(readFocusedComment({ ctx: "merdeka~class" })).toEqual(Option.none());
    expect(readFocusedComment({ comment: 1 })).toEqual(Option.none());
  });
});
