// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { LOCALES } from "@repo/internationalization/src/locale";
import { Array as Arr } from "effect";
import { listSocialImageSources } from "@/lib/static/social";

describe("social image sources", () => {
  it("lists the home image and one image per section in every locale", () => {
    const sources = listSocialImageSources(LOCALES);

    expect(sources).toHaveLength(LOCALES.length * 3);
    for (const locale of LOCALES) {
      expect(sources).toContainEqual({ locale, slug: "" });
      expect(sources).toContainEqual({ locale, slug: "articles" });
      expect(sources).toContainEqual({ locale, slug: "curriculum" });
    }
  });

  it("lists no image for a page, because pages share their section image", () => {
    const sources = listSocialImageSources(["en"]);

    expect(Arr.some(sources, ({ slug }) => slug.includes("/"))).toBe(false);
  });
});
