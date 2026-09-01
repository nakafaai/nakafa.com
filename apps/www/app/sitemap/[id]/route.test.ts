// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Data, Effect } from "effect";
import { GET } from "@/app/sitemap/[id]/route";

const mockGetSitemapEntries = vi.hoisted(() => vi.fn());
const mockGetSitemapPageDescriptor = vi.hoisted(() => vi.fn());
const mockCaptureServerException = vi.hoisted(() => vi.fn());

/** Test-only typed sitemap page failure. */
class TestSitemapPageError extends Data.TaggedError("TestSitemapPageError")<{
  readonly message: string;
}> {}

vi.mock("@/lib/sitemap/entries", () => ({
  getSitemapEntries: mockGetSitemapEntries,
}));

vi.mock("@/lib/sitemap/identity", () => ({
  getSitemapPageDescriptor: mockGetSitemapPageDescriptor,
}));

vi.mock("@repo/analytics/posthog/server", () => ({
  captureServerException: mockCaptureServerException,
}));

describe("sitemap page route", () => {
  beforeEach(() => {
    mockCaptureServerException.mockReset();
    mockCaptureServerException.mockReturnValue(Effect.void);
    mockGetSitemapEntries.mockReset();
    mockGetSitemapPageDescriptor.mockReset();
    mockGetSitemapPageDescriptor.mockImplementation((pageId) =>
      pageId === "base" ? { id: "base" } : null
    );
    mockGetSitemapEntries.mockReturnValue(
      Effect.succeed([
        {
          lastModified: new Date("2025-01-01T00:00:00.000Z"),
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
    expect(response.headers.get("Vercel-Cache-Tag")).toBe("content-sitemap");
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
      bucket: "fff",
      id: "article_en_fff",
      kind: "article",
      locale: "en",
    });
    mockGetSitemapEntries.mockReturnValueOnce(
      Effect.fail({
        _tag: "SitemapPageNotFoundError" as const,
        pageId: "article_en_fff",
      })
    );

    const response = await GET(
      new Request("https://nakafa.com/sitemap/article_en_fff.xml"),
      {
        params: Promise.resolve({ id: "article_en_fff.xml" }),
      }
    );

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not found");
    expect(mockCaptureServerException).not.toHaveBeenCalled();
  });

  it("reports page failures and returns a plain error response", async () => {
    const failure = new TestSitemapPageError({ message: "page read failed" });
    mockGetSitemapEntries.mockReturnValueOnce(Effect.fail(failure));

    const response = await GET(
      new Request("https://nakafa.com/sitemap/base.xml"),
      { params: Promise.resolve({ id: "base.xml" }) }
    );

    expect(response.status).toBe(500);
    expect(await response.text()).toBe("Internal Server Error");
    expect(mockCaptureServerException).toHaveBeenCalledWith(failure, {
      source: "sitemap-page",
    });
  });
});
