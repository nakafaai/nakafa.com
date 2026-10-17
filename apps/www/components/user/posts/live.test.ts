import { PaginatedQueryResult } from "@confect/react";
import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";
import { livePostsArgs, postsView } from "@/components/user/posts/live";
import type { ListPost } from "@/components/user/posts/state";

/** A post row with the given id, as the server sends it. */
function row(id: string): ListPost {
  return {
    _creationTime: 1,
    _id: Schema.decodeUnknownSync(Id("posts"))(id),
    likeCount: 0,
    liked: false,
    text: id,
  };
}

const post = row("live");
const serverPost = row("server");

describe("posts list view", () => {
  it("shows the server's first page while the live list loads its first page, and holds nothing yet", () => {
    expect(
      postsView(PaginatedQueryResult.loadingFirstPage({ skipped: false }), [
        serverPost,
      ])
    ).toEqual({
      empty: false,
      failed: false,
      ready: false,
      rows: [serverPost],
    });
  });

  it("shows nothing while the live list loads its first page and no server page was read", () => {
    expect(
      postsView(PaginatedQueryResult.loadingFirstPage({ skipped: false }), null)
    ).toEqual({ empty: false, failed: false, ready: false, rows: [] });
  });

  it("shows the live first page, and holds the list once it answers", () => {
    expect(
      postsView(
        PaginatedQueryResult.canLoadMore({
          loadMore: () => undefined,
          results: [post],
        }),
        [serverPost]
      )
    ).toEqual({ empty: false, failed: false, ready: true, rows: [post] });
  });

  it("says the list is empty once the live list answers with no posts", () => {
    expect(
      postsView(PaginatedQueryResult.exhausted({ results: [] }), [])
    ).toEqual({ empty: true, failed: false, ready: true, rows: [] });
  });

  it("keeps the rows of a list that loads its next page", () => {
    expect(
      postsView(PaginatedQueryResult.loadingMore({ results: [post] }), null)
    ).toEqual({ empty: false, failed: false, ready: true, rows: [post] });
  });

  it("shows a failed first page above the server's page, and never the empty sentence", () => {
    expect(
      postsView(
        PaginatedQueryResult.failure({ error: "failed", results: [] }),
        [serverPost]
      )
    ).toEqual({
      empty: false,
      failed: true,
      ready: false,
      rows: [serverPost],
    });
  });

  it("shows a failed first page with no server page as the failure alone", () => {
    expect(
      postsView(
        PaginatedQueryResult.failure({ error: "failed", results: [] }),
        null
      )
    ).toEqual({ empty: false, failed: true, ready: false, rows: [] });
  });

  it("keeps the rows of a failed later page, shows the failure, and holds the list", () => {
    expect(
      postsView(
        PaginatedQueryResult.failure({ error: "failed", results: [post] }),
        [serverPost]
      )
    ).toEqual({ empty: false, failed: true, ready: true, rows: [post] });
  });
});

describe("posts live subscription", () => {
  const authorId = Schema.decodeUnknownSync(Id("users"))("author");

  it("asks for the author's posts once Convex confirms the session", () => {
    expect(livePostsArgs(authorId, true)).toEqual({ authorId });
  });

  it("asks for nothing before Convex confirms the session, so no empty answer replaces the server's page", () => {
    expect(livePostsArgs(authorId, false)).toBe("skip");
  });
});
