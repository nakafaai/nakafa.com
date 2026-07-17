// @vitest-environment node
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/sitemap/[id]/route";

const mockGetSitemapEntries = vi.hoisted(() => vi.fn());
const mockGetSitemapPageDescriptor = vi.hoisted(() => vi.fn());
const mockCaptureServerException = vi.hoisted(() => vi.fn());

vi.mock("@/lib/sitemap/entries", () => ({
  getSitemapEntries: mockGetSitemapEntries,
}));

vi.mock("@/lib/sitemap/routes", () => ({
  getSitemapPageDescriptor: mockGetSitemapPageDescriptor,
}));

vi.mock("@repo/analytics/posthog/server", () => ({
  captureServerException: mockCaptureServerException,
}));

describe("sitemap page route", () => {
  beforeEach(() => {
    mockCaptureServerException.mockReset();
    mockGetSitemapEntries.mockReset();
    mockGetSitemapPageDescriptor.mockReset();
    mockGetSitemapPageDescriptor.mockImplementation((pageId) =>
      pageId === "base" ? { id: "base" } : null
    );
    mockGetSitemapEntries.mockReturnValue(
      Effect.succeed([
        {
          alternates: {
            languages: {
              en: "https://nakafa.com/en",
              id: "https://nakafa.com/id",
            },
          },
          changeFrequency: "monthly",
          lastModified: new Date("2025-01-01T00:00:00.000Z"),
          priority: 1,
          url: "https://nakafa.com/en",
        },
      ])
    );
  });

  it("serves one bounded sitemap page by .xml id", async () => {
    const response = await GET(
      new Request("https://nakafa.com/sitemap/base.xml"),
      { params: Promise.resolve({ id: "base.xml" }) }
    );
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/xml");
    expect(text).toContain("<urlset");
    expect(text).toContain("<loc>https://nakafa.com/en</loc>");
    expect(mockGetSitemapEntries).toHaveBeenCalledWith({ pageId: "base" });
  });

  it("rejects non-XML sitemap page segments", async () => {
    const response = await GET(new Request("https://nakafa.com/sitemap/base"), {
      params: Promise.resolve({ id: "base" }),
    });

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not found");
    expect(mockGetSitemapEntries).not.toHaveBeenCalled();
  });

  it("rejects empty sitemap page ids", async () => {
    const response = await GET(new Request("https://nakafa.com/sitemap/.xml"), {
      params: Promise.resolve({ id: ".xml" }),
    });

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not found");
    expect(mockGetSitemapEntries).not.toHaveBeenCalled();
  });

  it("rejects unknown XML sitemap page ids", async () => {
    const response = await GET(
      new Request("https://nakafa.com/sitemap/unknown.xml"),
      { params: Promise.resolve({ id: "unknown.xml" }) }
    );

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not found");
    expect(mockGetSitemapEntries).not.toHaveBeenCalled();
  });

  it("rejects canonical ids whose materialized page does not exist", async () => {
    mockGetSitemapPageDescriptor.mockReturnValueOnce({
      id: "content_en_articles_999",
      kind: "content",
      locale: "en",
      page: 999,
      section: "articles",
    });
    mockGetSitemapEntries.mockReturnValueOnce(
      Effect.fail({
        _tag: "SitemapPageNotFoundError" as const,
        pageId: "content_en_articles_999",
      })
    );

    const response = await GET(
      new Request("https://nakafa.com/sitemap/content_en_articles_999.xml"),
      {
        params: Promise.resolve({ id: "content_en_articles_999.xml" }),
      }
    );

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not found");
    expect(mockCaptureServerException).not.toHaveBeenCalled();
  });

  it("reports page failures and returns a plain error response", async () => {
    mockGetSitemapEntries.mockReturnValueOnce(
      Effect.fail(new Error("page read failed"))
    );

    const response = await GET(
      new Request("https://nakafa.com/sitemap/base.xml"),
      { params: Promise.resolve({ id: "base.xml" }) }
    );

    expect(response.status).toBe(500);
    expect(await response.text()).toBe("Internal Server Error");
    expect(mockCaptureServerException).toHaveBeenCalledWith(
      expect.any(Error),
      undefined,
      { source: "sitemap-page" }
    );
  });
});
