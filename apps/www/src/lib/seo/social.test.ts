// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { getOgUrl, getSocialMetadata } from "@/lib/seo/social";

describe("getOgUrl", () => {
  it("answers the section image for an article", () => {
    expect(getOgUrl("en", "/articles/politics/x")).toBe(
      "/en/og/articles/image.png"
    );
  });

  it("answers the section image of every spelling of the curricula section", () => {
    expect(getOgUrl("en", "/curriculum/merdeka")).toBe(
      "/en/og/curriculum/image.png"
    );
    expect(getOgUrl("id", "/kurikulum/merdeka")).toBe(
      "/id/og/curriculum/image.png"
    );
    expect(getOgUrl("de", "/lehrplaene/merdeka")).toBe(
      "/de/og/curriculum/image.png"
    );
  });

  it("answers the home image for a page with no section image of its own", () => {
    expect(getOgUrl("de", "/impressum")).toBe("/de/og/image.png");
    expect(getOgUrl("id", "/materi/matematika/")).toBe("/id/og/image.png");
    expect(getOgUrl("en", "/quran/1")).toBe("/en/og/image.png");
    expect(getOgUrl("id", "/try-out/indonesia/snbt")).toBe("/id/og/image.png");
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
