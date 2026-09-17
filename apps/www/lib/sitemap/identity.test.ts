import { describe, expect, it } from "@effect/vitest";
import {
  formatArticlePartition,
  formatMaterialPartition,
  formatProgramPartition,
  getSitemapPageDescriptor,
  isPartitionSitemapPage,
} from "@/lib/sitemap/identity";

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

  it("parses capacity-owned partition pages alongside hash buckets", () => {
    expect(getSitemapPageDescriptor("material_en_p0")).toEqual({
      id: "material_en_p0",
      kind: "material",
      locale: "en",
      partition: 0,
    });
    expect(getSitemapPageDescriptor("article_id_p12")).toEqual({
      id: "article_id_p12",
      kind: "article",
      locale: "id",
      partition: 12,
    });
    expect(getSitemapPageDescriptor("program_de_p3")).toEqual({
      id: "program_de_p3",
      kind: "program",
      locale: "de",
      partition: 3,
    });
    expect(formatMaterialPartition("en", 0)).toBe("material_en_p0");
    expect(formatArticlePartition("id", 12)).toBe("article_id_p12");
    expect(formatProgramPartition("de", 3)).toBe("program_de_p3");
    expect(isPartitionSitemapPage({ id: "base" })).toBe(false);
    const partition = getSitemapPageDescriptor("material_en_p0");
    expect(partition && isPartitionSitemapPage(partition)).toBe(true);
    const bucket = getSitemapPageDescriptor("material_en_def");
    expect(bucket && isPartitionSitemapPage(bucket)).toBe(false);
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
    "material_en_p",
    "material_en_p-1",
    "material_en_p01",
    "material_en_p1.5",
    "program_en",
    "",
  ])("rejects malformed id %s", (id) => {
    expect(getSitemapPageDescriptor(id)).toBeNull();
  });
});
