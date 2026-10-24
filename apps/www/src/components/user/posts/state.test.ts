import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";
import {
  type ListPost,
  likePost,
  prependPost,
  removePost,
  unlikePost,
  updatePost,
} from "@/components/user/posts/state";

/** A post row with the given id and text, as the server sends it. */
function row(id: string, overrides: Partial<ListPost> = {}): ListPost {
  return {
    _creationTime: 1,
    _id: Schema.decodeUnknownSync(Id("posts"))(id),
    likeCount: 0,
    liked: false,
    text: id,
    ...overrides,
  };
}

const first = row("first");
const second = row("second");

describe("posts list state", () => {
  it("puts a new post at the top of the page", () => {
    const added = row("new");
    expect(prependPost([first, second], added)).toEqual([added, first, second]);
  });

  it("changes only the post with the given id", () => {
    expect(
      updatePost([first, second], second._id, (post) => ({
        ...post,
        text: "changed",
      }))
    ).toEqual([first, { ...second, text: "changed" }]);
  });

  it("takes only the post with the given id off the page", () => {
    expect(removePost([first, second], first._id)).toEqual([second]);
    expect(removePost([first, second], row("missing")._id)).toEqual([
      first,
      second,
    ]);
  });

  it("counts a like once and marks the post liked", () => {
    expect(likePost(first)).toEqual({ ...first, liked: true, likeCount: 1 });
  });

  it("counts a repeated like once, so a double press changes the count once", () => {
    expect(likePost(likePost(first))).toEqual(likePost(first));
    expect(likePost(likePost(first)).likeCount).toBe(1);
  });

  it("takes a like back, which is the reverse of a like", () => {
    const liked = likePost(first);
    expect(unlikePost(liked)).toEqual(first);
  });

  it("takes a repeated unlike back once, and keeps a count of zero", () => {
    const liked = likePost(first);
    expect(unlikePost(unlikePost(liked))).toEqual(first);
    expect(unlikePost(unlikePost(liked)).likeCount).toBe(0);
  });
});
