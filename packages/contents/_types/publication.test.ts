import {
  encodeArticlePublicationCursor,
  hasArticlePublicationCursorPrefix,
} from "@repo/contents/_types/publication";
import { describe, expect, it } from "vitest";

describe("article publication cursor", () => {
  it("owns the article publication cursor wire prefix", () => {
    const cursor = encodeArticlePublicationCursor("current-position");

    expect(cursor).toBe("article-publication:v1:current-position");
    expect(hasArticlePublicationCursorPrefix(cursor)).toBe(true);
    expect(hasArticlePublicationCursorPrefix("native-position")).toBe(false);
  });
});
