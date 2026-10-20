// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import {
  serveSitemapIndex,
  serveSitemapPage,
} from "@/lib/sitemap/route.server";

const getCachedSitemapDescriptorsMock = vi.hoisted(() => vi.fn());
const getCachedSitemapEntriesMock = vi.hoisted(() => vi.fn());
const captureMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/sitemap/catalog", () => ({
  /** Controls the sitemap pages that the release lists. */
  getCachedSitemapDescriptors: getCachedSitemapDescriptorsMock,
}));

vi.mock("@/lib/sitemap/entries", () => ({
  /** Controls the entries of one sitemap page. */
  getCachedSitemapEntries: getCachedSitemapEntriesMock,
}));

vi.mock("@/lib/analytics/exception.server", () => ({
  /** Records every sitemap failure that the route reports. */
  captureServerExceptionSafely: captureMock,
}));

const descriptors = [{ id: "article_en_p0", kind: "article", locale: "en" }];

beforeEach(() => {
  getCachedSitemapDescriptorsMock.mockReset().mockResolvedValue(descriptors);
  getCachedSitemapEntriesMock.mockReset().mockResolvedValue({
    _tag: "Found",
    entries: [{ url: "https://nakafa.com/en/articles/belajar" }],
  });
  captureMock.mockReset().mockReturnValue(Effect.void);
});

describe("sitemap index route", () => {
  it("lists every sitemap page of the release", async () => {
    const response = await serveSitemapIndex();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "application/xml; charset=utf-8"
    );
    expect(response.headers.get("vercel-cache-tag")).toBe("content-sitemap");
    const body = await response.text();
    expect(body).toContain("https://nakafa.com/sitemap/article_en_p0.xml");
  });

  it("reports a failed index and answers 500 without details", async () => {
    getCachedSitemapDescriptorsMock.mockRejectedValue(new Error("convex"));

    const response = await serveSitemapIndex();

    expect(response.status).toBe(500);
    await expect(response.text()).resolves.toBe("Internal Server Error");
    expect(captureMock).toHaveBeenCalledWith(expect.any(Error), {
      source: "sitemap-index",
    });
  });
});

describe("sitemap page route", () => {
  it("answers the entries of a listed page", async () => {
    const response = await serveSitemapPage({
      params: { id: "article_en_p0.xml" },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "application/xml; charset=utf-8"
    );
    await expect(response.text()).resolves.toContain(
      "https://nakafa.com/en/articles/belajar"
    );
    expect(getCachedSitemapEntriesMock).toHaveBeenCalledWith({
      pageId: "article_en_p0",
    });
  });

  it("answers 404 for an id without the xml suffix or with no name", async () => {
    const plain = await serveSitemapPage({ params: { id: "article_en_p0" } });
    const unnamed = await serveSitemapPage({ params: { id: ".xml" } });

    expect(plain.status).toBe(404);
    expect(unnamed.status).toBe(404);
    expect(getCachedSitemapDescriptorsMock).not.toHaveBeenCalled();
  });

  it("answers 404 without a Convex read for an unknown page", async () => {
    const response = await serveSitemapPage({
      params: { id: "unknown-page-9.xml" },
    });

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toBe("Not found");
    expect(getCachedSitemapEntriesMock).not.toHaveBeenCalled();
  });

  it("answers 404 for a valid page that the release does not list", async () => {
    getCachedSitemapDescriptorsMock.mockResolvedValue([]);

    const response = await serveSitemapPage({
      params: { id: "article_en_p0.xml" },
    });

    expect(response.status).toBe(404);
    expect(getCachedSitemapEntriesMock).not.toHaveBeenCalled();
  });

  it("answers 404 when the stored page is missing", async () => {
    getCachedSitemapEntriesMock.mockResolvedValue({ _tag: "Missing" });

    const response = await serveSitemapPage({
      params: { id: "article_en_p0.xml" },
    });

    expect(response.status).toBe(404);
  });

  it("reports a failed page and answers 500 without details", async () => {
    getCachedSitemapEntriesMock.mockRejectedValue(new Error("store"));

    const response = await serveSitemapPage({
      params: { id: "article_en_p0.xml" },
    });

    expect(response.status).toBe(500);
    expect(captureMock).toHaveBeenCalledWith(expect.any(Error), {
      source: "sitemap-page",
    });
  });
});
