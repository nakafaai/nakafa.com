// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Data, Effect } from "effect";
import { GET } from "@/app/sitemap/[id]/route";

const mockGetCachedSitemapDescriptors = vi.hoisted(() => vi.fn());
const mockGetCachedSitemapEntries = vi.hoisted(() => vi.fn());
const mockGetSitemapPageDescriptor = vi.hoisted(() => vi.fn());
const mockCaptureServerExceptionSafely = vi.hoisted(() => vi.fn());

/** Test-only typed sitemap page failure. */
class TestSitemapPageError extends Data.TaggedError("TestSitemapPageError")<{
  readonly message: string;
}> {}

vi.mock("@/lib/sitemap/catalog", () => ({
  getCachedSitemapDescriptors: mockGetCachedSitemapDescriptors,
}));

vi.mock("@/lib/sitemap/entries", () => ({
  getCachedSitemapEntries: mockGetCachedSitemapEntries,
}));

vi.mock("@/lib/sitemap/identity", () => ({
  getSitemapPageDescriptor: mockGetSitemapPageDescriptor,
}));

vi.mock("@/lib/analytics/server", () => ({
  captureServerExceptionSafely: mockCaptureServerExceptionSafely,
}));

describe("sitemap page route", () => {
  beforeEach(() => {
    mockCaptureServerExceptionSafely.mockReset();
    mockCaptureServerExceptionSafely.mockReturnValue(Effect.void);
    mockGetCachedSitemapDescriptors
      .mockReset()
      .mockResolvedValue([
        { id: "base" },
        { id: "material_en_p7", kind: "material", locale: "en", partition: 7 },
      ]);
    mockGetCachedSitemapEntries.mockReset();
    mockGetSitemapPageDescriptor.mockReset();
    mockGetSitemapPageDescriptor.mockImplementation((pageId) =>
      pageId === "base" ? { id: "base" } : null
    );
    mockGetCachedSitemapEntries.mockResolvedValue({
      _tag: "Found",
      entries: [
        {
          lastModified: "2025-01-01T00:00:00.000Z",
          url: "https://nakafa.com/en",
        },
      ],
    });
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
    expect(mockGetCachedSitemapEntries).toHaveBeenCalledWith({
      pageId: "base",
    });
  });

  it("rejects non-XML sitemap page segments", async () => {
    const response = await GET(new Request("https://nakafa.com/sitemap/base"), {
      params: Promise.resolve({ id: "base" }),
    });

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not found");
    expect(mockGetCachedSitemapEntries).not.toHaveBeenCalled();
  });

  it("rejects empty sitemap page ids", async () => {
    const response = await GET(new Request("https://nakafa.com/sitemap/.xml"), {
      params: Promise.resolve({ id: ".xml" }),
    });

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not found");
    expect(mockGetCachedSitemapEntries).not.toHaveBeenCalled();
  });

  it("rejects unknown XML sitemap page ids", async () => {
    const response = await GET(
      new Request("https://nakafa.com/sitemap/unknown.xml"),
      { params: Promise.resolve({ id: "unknown.xml" }) }
    );

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not found");
    expect(mockGetCachedSitemapEntries).not.toHaveBeenCalled();
  });

  it("rejects a well-formed id that the release does not list, without reading or caching it", async () => {
    mockGetSitemapPageDescriptor.mockReturnValueOnce({
      id: "article_en_p999999",
      kind: "article",
      locale: "en",
      partition: 999_999,
    });

    const response = await GET(
      new Request("https://nakafa.com/sitemap/article_en_p999999.xml"),
      { params: Promise.resolve({ id: "article_en_p999999.xml" }) }
    );

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not found");
    expect(mockGetCachedSitemapEntries).not.toHaveBeenCalled();
    expect(mockCaptureServerExceptionSafely).not.toHaveBeenCalled();
  });

  it("reports a failed index read as a page failure", async () => {
    const failure = new TestSitemapPageError({ message: "index read failed" });
    mockGetCachedSitemapDescriptors.mockRejectedValueOnce(failure);

    const response = await GET(
      new Request("https://nakafa.com/sitemap/base.xml"),
      { params: Promise.resolve({ id: "base.xml" }) }
    );

    expect(response.status).toBe(500);
    expect(mockGetCachedSitemapEntries).not.toHaveBeenCalled();
    expect(mockCaptureServerExceptionSafely).toHaveBeenCalledWith(failure, {
      source: "sitemap-page",
    });
  });

  it("rejects canonical ids whose materialized page does not exist", async () => {
    mockGetSitemapPageDescriptor.mockReturnValueOnce({
      id: "material_en_p7",
      kind: "material",
      locale: "en",
      partition: 7,
    });
    mockGetCachedSitemapEntries.mockResolvedValueOnce({ _tag: "Missing" });

    const response = await GET(
      new Request("https://nakafa.com/sitemap/material_en_p7.xml"),
      {
        params: Promise.resolve({ id: "material_en_p7.xml" }),
      }
    );

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not found");
    expect(mockCaptureServerExceptionSafely).not.toHaveBeenCalled();
  });

  it("reports page failures and returns a plain error response", async () => {
    const failure = new TestSitemapPageError({ message: "page read failed" });
    mockGetCachedSitemapEntries.mockRejectedValueOnce(failure);

    const response = await GET(
      new Request("https://nakafa.com/sitemap/base.xml"),
      { params: Promise.resolve({ id: "base.xml" }) }
    );

    expect(response.status).toBe(500);
    expect(await response.text()).toBe("Internal Server Error");
    expect(mockCaptureServerExceptionSafely).toHaveBeenCalledWith(failure, {
      source: "sitemap-page",
    });
  });
});
