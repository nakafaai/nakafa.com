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

  it("builds a sitemap URL set with metadata and alternate links", () => {
    const xml = buildSitemapUrlSetXml([
      {
        alternates: {
          languages: {
            en: "https://nakafa.com/en/articles/example",
            id: "https://nakafa.com/id/articles/example",
            "x-default": "https://nakafa.com/en/articles/example",
          },
        },
        changeFrequency: "monthly",
        lastModified: new Date("2025-01-01T00:00:00.000Z"),
        priority: 0.5,
        url: "https://nakafa.com/en/articles/example",
      },
    ]);

    expect(xml).toContain(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">'
    );
    expect(xml).toContain("<loc>https://nakafa.com/en/articles/example</loc>");
    expect(xml).toContain("<lastmod>2025-01-01T00:00:00.000Z</lastmod>");
    expect(xml).toContain("<changefreq>monthly</changefreq>");
    expect(xml).toContain("<priority>0.5</priority>");
    expect(xml).toContain(
      '<xhtml:link rel="alternate" hreflang="id" href="https://nakafa.com/id/articles/example" />'
    );
  });

  it("omits optional metadata and empty alternate URLs", () => {
    const xml = buildSitemapUrlSetXml([
      {
        alternates: {
          languages: {
            en: undefined,
            id: "https://nakafa.com/id/articles/string-date",
          },
        },
        lastModified: "2025-02-01",
        url: "https://nakafa.com/en/articles/string-date",
      },
      {
        url: "https://nakafa.com/en/articles/plain?title=<plain>",
      },
    ]);

    expect(xml).toContain("<lastmod>2025-02-01</lastmod>");
    expect(xml).toContain(
      '<xhtml:link rel="alternate" hreflang="id" href="https://nakafa.com/id/articles/string-date" />'
    );
    expect(xml).not.toContain('hreflang="en"');
    expect(xml).toContain(
      "<loc>https://nakafa.com/en/articles/plain?title=&lt;plain&gt;</loc>"
    );
  });
});
