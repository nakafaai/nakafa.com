import { describe, expect, it } from "vitest";
import { getSitemapPageDescriptor } from "@/lib/sitemap/identity";

describe("sitemap page identity", () => {
  it("parses every canonical page kind", () => {
    expect(getSitemapPageDescriptor("base")).toEqual({ id: "base" });
    expect(getSitemapPageDescriptor("content_en_articles_1")).toEqual({
      id: "content_en_articles_1",
      kind: "content",
      locale: "en",
      page: 1,
      section: "articles",
    });
    expect(getSitemapPageDescriptor("public_en_1")).toEqual({
      id: "public_en_1",
      kind: "public",
      locale: "en",
      page: 1,
    });
    expect(getSitemapPageDescriptor("article_en_abc")).toEqual({
      bucket: "abc",
      id: "article_en_abc",
      kind: "article",
      locale: "en",
    });
  });

  it.each([
    "content_en_articles_01",
    "content_en_articles_-1",
    "content_en_articles_1.5",
    "content_en_unknown_1",
    "content_unknown_articles_1",
    "public_en",
    "public_en_invalid",
    "public_en_",
    "pages_en_articles_1",
    "article_en_wrong",
    "article_en",
    "",
  ])("rejects malformed id %s", (id) => {
    expect(getSitemapPageDescriptor(id)).toBeNull();
  });
});
