import { describe, expect, it } from "@effect/vitest";
import { getSitemapPageDescriptor } from "@/lib/sitemap/identity";

describe("sitemap page identity", () => {
  it("parses every canonical page kind", () => {
    expect(getSitemapPageDescriptor("base")).toEqual({ id: "base" });
    expect(getSitemapPageDescriptor("quran_en")).toEqual({
      id: "quran_en",
      kind: "quran",
      locale: "en",
    });
    expect(getSitemapPageDescriptor("article_en_abc")).toEqual({
      bucket: "abc",
      id: "article_en_abc",
      kind: "article",
      locale: "en",
    });
    expect(getSitemapPageDescriptor("material_en_def")).toEqual({
      bucket: "def",
      id: "material_en_def",
      kind: "material",
      locale: "en",
    });
    expect(getSitemapPageDescriptor("program_id_012")).toEqual({
      bucket: "012",
      id: "program_id_012",
      kind: "program",
      locale: "id",
    });
    expect(getSitemapPageDescriptor("page_de")).toEqual({
      id: "page_de",
      kind: "page",
      locale: "de",
    });
    expect(getSitemapPageDescriptor("tryout_id_0")).toEqual({
      id: "tryout_id_0",
      kind: "tryout",
      locale: "id",
      page: 0,
    });
  });

  it.each([
    "quran_en_extra",
    "quran_unknown",
    "content_en_articles_01",
    "content_en_articles_-1",
    "content_en_articles_1.5",
    "content_en_unknown_1",
    "content_unknown_articles_1",
    "public_en",
    "public_en_invalid",
    "public_en_",
    "page_en_extra",
    "tryout_en",
    "tryout_en_",
    "tryout_en_01",
    "tryout_en_invalid",
    "pages_en_articles_1",
    "article_en_wrong",
    "article_en",
    "material_en_wrong",
    "program_en",
    "",
  ])("rejects malformed id %s", (id) => {
    expect(getSitemapPageDescriptor(id)).toBeNull();
  });
});
