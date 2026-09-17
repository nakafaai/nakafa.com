// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Data, Effect } from "effect";
import { GET } from "@/app/sitemap.xml/route";

const mockGetCachedSitemapDescriptors = vi.hoisted(() => vi.fn());
const mockCaptureServerExceptionSafely = vi.hoisted(() => vi.fn());

/** Test-only typed sitemap failure. */
class TestSitemapIndexError extends Data.TaggedError("TestSitemapIndexError")<{
  readonly message: string;
}> {}

vi.mock("@/lib/sitemap/catalog", () => ({
  getCachedSitemapDescriptors: mockGetCachedSitemapDescriptors,
}));

vi.mock("@/lib/analytics/server", () => ({
  captureServerExceptionSafely: mockCaptureServerExceptionSafely,
}));

describe("sitemap index route", () => {
  beforeEach(() => {
    mockCaptureServerExceptionSafely.mockReset();
    mockCaptureServerExceptionSafely.mockReturnValue(Effect.void);
    mockGetCachedSitemapDescriptors.mockReset();
    mockGetCachedSitemapDescriptors.mockResolvedValue([
      { id: "base" },
      { id: "material_en_p0" },
    ]);
  });

  it("serves a conventional canonical sitemap index for bounded sitemap pages", async () => {
    const response = await GET();
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/xml");
    expect(response.headers.get("Vercel-Cache-Tag")).toBe("content-sitemap");
    expect(text).toContain("<sitemapindex");
    expect(text).toContain("https://nakafa.com/sitemap/base.xml");
    expect(text).toContain("https://nakafa.com/sitemap/material_en_p0.xml");
    expect(text).not.toContain("https://nakafa.id");
  });

  it("reports descriptor failures and returns a plain error response", async () => {
    const failure = new TestSitemapIndexError({
      message: "descriptor read failed",
    });
    mockGetCachedSitemapDescriptors.mockRejectedValueOnce(failure);

    const response = await GET();

    expect(response.status).toBe(500);
    expect(await response.text()).toBe("Internal Server Error");
    expect(mockCaptureServerExceptionSafely).toHaveBeenCalledWith(failure, {
      source: "sitemap-index",
    });
  });
});
