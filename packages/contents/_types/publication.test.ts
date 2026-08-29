import { describe, expect, it } from "@effect/vitest";
import {
  encodeArticlePublicationCursor,
  hasArticlePublicationCursorPrefix,
} from "@repo/contents/_types/publication";

describe("article publication cursor", () => {
  it("owns the article publication cursor wire prefix", () => {
    const cursor = encodeArticlePublicationCursor("current-position");

    expect(cursor).toBe("article-publication|current-position");
    expect(hasArticlePublicationCursorPrefix(cursor)).toBe(true);
    expect(
      hasArticlePublicationCursorPrefix(
        "article-publication:v1:current-position"
      )
    ).toBe(false);
    expect(hasArticlePublicationCursorPrefix("native-position")).toBe(false);
  });
});
