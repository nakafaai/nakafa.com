import { describe, expect, it } from "vitest";
import { getOgUrl, getSocialMetadata } from "@/lib/utils/metadata";

describe("getOgUrl", () => {
  it("returns OG URL for path with leading slash", () => {
    const result = getOgUrl("en", "/docs/getting-started");
    expect(result).toBe("/en/og/docs/getting-started/image.png");
  });

  it("handles path without leading slash", () => {
    const result = getOgUrl("en", "docs/getting-started");
    expect(result).toBe("/en/og/docs/getting-started/image.png");
  });

  it("returns OG URL for Indonesian locale", () => {
    const result = getOgUrl("id", "/about");
    expect(result).toBe("/id/og/about/image.png");
  });

  it("handles nested paths", () => {
    const result = getOgUrl("en", "/packages/app/components/Button");
    expect(result).toBe("/en/og/packages/app/components/Button/image.png");
  });

  it("handles root path", () => {
    const result = getOgUrl("en", "/");
    expect(result).toBe("/en/og/image.png");
  });

  it("handles empty path", () => {
    const result = getOgUrl("en", "");
    expect(result).toBe("/en/og/image.png");
  });

  it("handles path with multiple leading slashes", () => {
    const result = getOgUrl("en", "//double/slash");
    expect(result).toBe("/en/og/double/slash/image.png");
  });

  it("handles paths with special characters", () => {
    const result = getOgUrl("en", "/blog/2024-12-24-release-notes");
    expect(result).toBe("/en/og/blog/2024-12-24-release-notes/image.png");
  });
});

describe("getSocialMetadata", () => {
  it("builds complete Open Graph and Twitter metadata for content pages", () => {
    const image =
      "/id/og/subject/high-school/11/mathematics/function-modeling/trigonometric-function-graph/image.png";
    const result = getSocialMetadata({
      title: "Grafik Fungsi Trigonometri",
      description: "Pelajari grafik fungsi trigonometri.",
      locale: "id",
      path: "/id/subject/high-school/11/mathematics/function-modeling/trigonometric-function-graph",
      image,
      type: "article",
    });

    expect(result.openGraph).toMatchObject({
      title: "Grafik Fungsi Trigonometri",
      description: "Pelajari grafik fungsi trigonometri.",
      url: "/id/subject/high-school/11/mathematics/function-modeling/trigonometric-function-graph",
      siteName: "Nakafa",
      locale: "id",
      type: "article",
    });
    expect(result.openGraph.images).toEqual([
      {
        url: image,
        alt: "Grafik Fungsi Trigonometri",
        width: 1200,
        height: 630,
      },
    ]);
    expect(result.twitter).toMatchObject({
      card: "summary_large_image",
      title: "Grafik Fungsi Trigonometri",
      description: "Pelajari grafik fungsi trigonometri.",
      creator: "@nabilfatih_",
      site: "@nabilfatih_",
    });
    expect(result.twitter.images).toEqual(result.openGraph.images);
  });

  it("does not fall back to the root OG image when a content image exists", () => {
    const result = getSocialMetadata({
      title: "Materi Kimia",
      description: "Belajar kimia.",
      locale: "id",
      path: "/id/subject/high-school/10/chemistry",
      image: "/id/og/subject/high-school/10/chemistry/image.png",
    });

    expect(result.openGraph.images).not.toContainEqual(
      expect.objectContaining({ url: "/og.png" })
    );
    expect(result.twitter.images).not.toContainEqual(
      expect.objectContaining({ url: "/og.png" })
    );
  });
});
