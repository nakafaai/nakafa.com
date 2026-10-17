import { PaginatedQueryResult } from "@confect/react";
import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";
import { holdsFirstPage } from "@/components/user/posts/live";
import type { ListPost } from "@/components/user/posts/state";

const post: ListPost = {
  _creationTime: 1,
  _id: Schema.decodeUnknownSync(Id("posts"))("first"),
  likeCount: 0,
  liked: false,
  text: "first",
};

describe("posts live list", () => {
  it("holds no first page while the list loads it", () => {
    expect(
      holdsFirstPage(PaginatedQueryResult.loadingFirstPage({ skipped: false }))
    ).toBe(false);
  });

  it("holds the first page once the list answers, and while more pages load", () => {
    expect(
      holdsFirstPage(
        PaginatedQueryResult.canLoadMore({
          loadMore: () => undefined,
          results: [post],
        })
      )
    ).toBe(true);
    expect(
      holdsFirstPage(PaginatedQueryResult.exhausted({ results: [] }))
    ).toBe(true);
    expect(
      holdsFirstPage(PaginatedQueryResult.loadingMore({ results: [post] }))
    ).toBe(true);
  });

  it("holds no first page when the first page failed, and keeps the first page when a later one failed", () => {
    expect(
      holdsFirstPage(
        PaginatedQueryResult.failure({ error: "failed", results: [] })
      )
    ).toBe(false);
    expect(
      holdsFirstPage(
        PaginatedQueryResult.failure({ error: "failed", results: [post] })
      )
    ).toBe(true);
  });
});
