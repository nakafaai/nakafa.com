// @vitest-environment node
import { describe, expect, it } from "vitest";
import { getOgUrl, getSocialMetadata } from "@/lib/utils/metadata";

describe("getOgUrl", () => {
  it("builds an image URL for a content path", () => {
    expect(getOgUrl("id", " /materi/matematika/ ")).toBe(
      "/id/og/materi/matematika/image.png"
    );
  });

  it("builds the locale root image URL for an empty path", () => {
    expect(getOgUrl("en", "/")).toBe("/en/og/image.png");
  });
});

describe("getSocialMetadata", () => {
  const input = {
    description: "Pelajari grafik fungsi trigonometri.",
    image: "/id/og/materi/matematika/image.png",
    locale: "id",
    path: "/id/materi/matematika",
    title: "Grafik Fungsi Trigonometri",
  } satisfies Parameters<typeof getSocialMetadata>[0];

  it("builds complete Open Graph and Twitter metadata", () => {
    const result = getSocialMetadata(input);
    const image = {
      alt: input.title,
      height: 630,
      url: input.image,
      width: 1200,
    };

    expect(result).toEqual({
      openGraph: {
        description: input.description,
        images: [image],
        locale: input.locale,
        siteName: "Nakafa",
        title: input.title,
        type: "website",
        url: input.path,
      },
      twitter: {
        card: "summary_large_image",
        creator: "@nabilfatih_",
        description: input.description,
        images: [image],
        site: "@nabilfatih_",
        title: input.title,
      },
    });
  });

  it("accepts an explicit Open Graph type", () => {
    expect(
      getSocialMetadata({ ...input, type: "article" }).openGraph.type
    ).toBe("article");
  });
});
