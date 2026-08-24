// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildSitemapIndexXml, buildSitemapUrlSetXml } from "@/lib/sitemap/xml";

describe("sitemap XML serialization", () => {
  it("builds a sitemap index for bounded sitemap page URLs", () => {
    const xml = buildSitemapIndexXml([
      "https://nakafa.com/sitemap/base.xml",
      "https://nakafa.com/sitemap/content_en_articles_0.xml?x=1&y=2",
    ]);

    expect(xml).toContain(
      '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    );
    expect(xml).toContain("<loc>https://nakafa.com/sitemap/base.xml</loc>");
    expect(xml).toContain(
      "<loc>https://nakafa.com/sitemap/content_en_articles_0.xml?x=1&amp;y=2</loc>"
    );
    expect(xml.endsWith("\n")).toBe(true);
  });

  it("builds a sitemap URL set with a truthful source date", () => {
    const xml = buildSitemapUrlSetXml([
      {
        lastModified: "2025-01-01",
        url: "https://nakafa.com/en/articles/example",
      },
    ]);

    expect(xml).toContain(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    );
    expect(xml).toContain("<loc>https://nakafa.com/en/articles/example</loc>");
    expect(xml).toContain("<lastmod>2025-01-01</lastmod>");
    expect(xml).not.toContain("changefreq");
    expect(xml).not.toContain("priority");
    expect(xml).not.toContain("xhtml");
    expect(xml).not.toContain("hreflang");
  });

  it("omits optional metadata and escapes canonical URLs", () => {
    const xml = buildSitemapUrlSetXml([
      {
        lastModified: "2025-02-01",
        url: "https://nakafa.com/en/articles/string-date",
      },
      {
        url: "https://nakafa.com/en/articles/plain?title=<plain>",
      },
    ]);

    expect(xml).toContain("<lastmod>2025-02-01</lastmod>");
    expect(xml).toContain(
      "<loc>https://nakafa.com/en/articles/plain?title=&lt;plain&gt;</loc>"
    );
  });
});
