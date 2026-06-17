// @vitest-environment node
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/sitemap.xml/route";

const mockReadSitemapPageDescriptors = vi.hoisted(() => vi.fn());
const mockCaptureServerException = vi.hoisted(() => vi.fn());

vi.mock("@/lib/sitemap/routes", () => ({
  readSitemapPageDescriptors: mockReadSitemapPageDescriptors,
}));

vi.mock("@repo/analytics/posthog/server", () => ({
  captureServerException: mockCaptureServerException,
}));

describe("sitemap index route", () => {
  beforeEach(() => {
    mockCaptureServerException.mockReset();
    mockReadSitemapPageDescriptors.mockReset();
    mockReadSitemapPageDescriptors.mockReturnValue(
      Effect.succeed([{ id: "base" }, { id: "content_id_quran_0" }])
    );
  });

  it("serves a conventional canonical sitemap index for bounded sitemap pages", async () => {
    const response = await GET();
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/xml");
    expect(text).toContain("<sitemapindex");
    expect(text).toContain("https://nakafa.com/sitemap/base.xml");
    expect(text).toContain("https://nakafa.com/sitemap/content_id_quran_0.xml");
    expect(text).not.toContain("https://nakafa.id");
  });

  it("reports descriptor failures and returns a plain error response", async () => {
    mockReadSitemapPageDescriptors.mockReturnValueOnce(
      Effect.fail(new Error("descriptor read failed"))
    );

    const response = await GET();

    expect(response.status).toBe(500);
    expect(await response.text()).toBe("Internal Server Error");
    expect(mockCaptureServerException).toHaveBeenCalledWith(
      expect.any(Error),
      undefined,
      { source: "sitemap-index" }
    );
  });
});
