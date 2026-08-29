import { describe, expect, it } from "@effect/vitest";
import {
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import { encodeArticlePublicationCursor } from "@repo/contents/_types/publication";
import { Option } from "effect";
import {
  getArticleNextHref,
  readArticlePageCursor,
  shouldResetArticlePublicationCursor,
  stripArticlePagination,
} from "@/lib/content/article/query";

const manifest = Sha256HashSchema.make(`sha256:${"a".repeat(64)}`);
const releaseId = ReleaseIdSchema.make("release-article");

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
          release: releaseId,
        })
      )
    ).toEqual({
      cursor: "next page",
      expectedManifestHash: manifest,
      expectedReleaseId: releaseId,
    });
  });

  it("rejects incomplete, repeated, and oversized query values", () => {
    expect(Option.isNone(readArticlePageCursor({ cursor: "next" }))).toBe(true);
    expect(
      Option.isNone(
        readArticlePageCursor({
          cursor: ["first", "second"],
          manifest,
          release: releaseId,
        })
      )
    ).toBe(true);
    expect(
      Option.isNone(
        readArticlePageCursor({
          cursor: "x".repeat(4097),
          manifest,
          release: releaseId,
        })
      )
    ).toBe(true);
  });

  it("removes release pagination while preserving unrelated query state", () => {
    expect(
      stripArticlePagination(
        "?cursor=next&manifest=source&release=source&ref=locale&ref=agent"
      )
    ).toBe("?ref=locale&ref=agent");
    expect(
      stripArticlePagination("?cursor=next&manifest=source&release=source")
    ).toBe("");
  });

  it("resets unsupported cursors at the current article publication", () => {
    const identity = {
      expectedManifestHash: manifest,
      expectedReleaseId: releaseId,
    };
    const current = encodeArticlePublicationCursor(
      JSON.stringify([
        "en",
        "politics",
        "2026-08-22",
        "articles/politics/current",
        1,
        "article-id",
      ])
    );

    expect(
      shouldResetArticlePublicationCursor({
        ...identity,
        cursor: "native-predecessor-position",
      })
    ).toBe(true);
    expect(
      shouldResetArticlePublicationCursor({
        ...identity,
        cursor: "article-publication:v1:[]",
      })
    ).toBe(true);
    expect(
      shouldResetArticlePublicationCursor({ ...identity, cursor: current })
    ).toBe(false);
    expect(
      shouldResetArticlePublicationCursor({
        ...identity,
        cursor: encodeArticlePublicationCursor("{"),
      })
    ).toBe(false);
    expect(
      shouldResetArticlePublicationCursor({
        cursor: null,
        expectedManifestHash: null,
        expectedReleaseId: null,
      })
    ).toBe(false);
  });

  it("builds encoded next links only for complete page identities", () => {
    expect(
      getArticleNextHref("/articles/politics", {
        activeManifestHash: manifest,
        activeReleaseId: releaseId,
        nextCursor: "next page",
      })
    ).toBe(
      `/articles/politics?cursor=next+page&manifest=${encodeURIComponent(manifest)}&release=release-article`
    );
    expect(
      getArticleNextHref("/articles", {
        activeManifestHash: manifest,
        activeReleaseId: releaseId,
        nextCursor: null,
      })
    ).toBeNull();
    expect(
      getArticleNextHref("/articles", {
        activeManifestHash: null,
        activeReleaseId: releaseId,
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
