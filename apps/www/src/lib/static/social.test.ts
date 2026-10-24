// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { LOCALES } from "@repo/internationalization/src/locale";
import { Array as Arr, Effect } from "effect";
import {
  listSocialImageSources,
  readSocialImageSources,
} from "@/lib/static/social";

const descriptorsMock = vi.hoisted(() => vi.fn());
const routesMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/sitemap/catalog", () => ({
  /** Controls the sitemap pages that the active release lists. */
  readSitemapPageDescriptors: descriptorsMock,
}));

vi.mock("@/lib/sitemap/routes", () => ({
  /** Controls the routes of one sitemap page. */
  readSitemapRoutePage: routesMock,
}));

describe("social image sources", () => {
  it("lists the home image and the articles index of every locale when no page is listed", () => {
    const sources = listSocialImageSources([]);

    expect(sources).toHaveLength(LOCALES.length * 2);
    for (const locale of LOCALES) {
      expect(sources).toContainEqual({ locale, slug: "" });
      expect(sources).toContainEqual({ locale, slug: "articles" });
    }
  });

  it("lists each route of a page in every locale of that page, without its slashes", () => {
    const sources = listSocialImageSources([
      { locales: ["en"], paths: ["/quran/1", "subjects/math/integral/"] },
    ]);

    expect(sources).toContainEqual({ locale: "en", slug: "quran/1" });
    expect(sources).toContainEqual({
      locale: "en",
      slug: "subjects/math/integral",
    });
    expect(
      Arr.some(
        sources,
        ({ locale, slug }) => locale === "id" && slug === "quran/1"
      )
    ).toBe(false);
  });

  it("lists a route once when several pages name it", () => {
    const sources = listSocialImageSources([
      { locales: ["en"], paths: ["/contributor"] },
      { locales: ["en"], paths: ["/contributor/"] },
    ]);

    const contributor = Arr.filter(
      sources,
      ({ locale, slug }) => locale === "en" && slug === "contributor"
    );
    expect(contributor).toHaveLength(1);
  });

  it.effect(
    "reads the routes of every sitemap page of the release into its social images",
    () =>
      Effect.gen(function* () {
        descriptorsMock.mockReturnValue(
          Effect.succeed([{ id: "base" }, { id: "quran_en" }])
        );
        routesMock.mockImplementation((pageId: string) =>
          Effect.succeed({
            routes:
              pageId === "quran_en" ? [{ path: "/quran/1" }] : [{ path: "/" }],
          })
        );

        const sources = yield* readSocialImageSources();

        expect(sources).toContainEqual({ locale: "en", slug: "quran/1" });
        expect(
          Arr.some(
            sources,
            ({ locale, slug }) => locale === "id" && slug === "quran/1"
          )
        ).toBe(false);
        expect(sources).toContainEqual({ locale: "id", slug: "" });
      })
  );
});
