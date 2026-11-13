// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { getOgUrl } from "@/lib/seo/social";

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
