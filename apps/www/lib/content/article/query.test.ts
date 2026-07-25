import { Option } from "effect";
import { describe, expect, it } from "vitest";
import {
  getArticleNextHref,
  readArticlePageCursor,
} from "@/lib/content/article/query";

const manifest = `sha256:${"a".repeat(64)}`;

describe("article catalog query", () => {
  it("decodes initial and release-bound cursors", () => {
    expect(Option.getOrNull(readArticlePageCursor({}))).toEqual({
      cursor: null,
      expectedManifestHash: null,
      expectedReleaseId: null,
    });
    expect(
      Option.getOrNull(
        readArticlePageCursor({
          cursor: "next page",
          manifest,
          release: "release-article",
        })
      )
    ).toEqual({
      cursor: "next page",
      expectedManifestHash: manifest,
      expectedReleaseId: "release-article",
    });
  });

  it("rejects incomplete, repeated, and oversized query values", () => {
    expect(Option.isNone(readArticlePageCursor({ cursor: "next" }))).toBe(true);
    expect(
      Option.isNone(
        readArticlePageCursor({
          cursor: ["first", "second"],
          manifest,
          release: "release-article",
        })
      )
    ).toBe(true);
    expect(
      Option.isNone(
        readArticlePageCursor({
          cursor: "x".repeat(4097),
          manifest,
          release: "release-article",
        })
      )
    ).toBe(true);
  });

  it("builds encoded next links only for complete page identities", () => {
    expect(
      getArticleNextHref("/articles/politics", {
        activeManifestHash: manifest,
        activeReleaseId: "release-article",
        nextCursor: "next page",
      })
    ).toBe(
      `/articles/politics?cursor=next+page&manifest=${encodeURIComponent(manifest)}&release=release-article`
    );
    expect(
      getArticleNextHref("/articles", {
        activeManifestHash: manifest,
        activeReleaseId: "release-article",
        nextCursor: null,
      })
    ).toBeNull();
    expect(
      getArticleNextHref("/articles", {
        activeManifestHash: null,
        activeReleaseId: "release-article",
        nextCursor: "next",
      })
    ).toBeNull();
    expect(
      getArticleNextHref("/articles", {
        activeManifestHash: manifest,
        activeReleaseId: null,
        nextCursor: "next",
      })
    ).toBeNull();
  });
});
