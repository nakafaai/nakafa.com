// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { routing } from "@repo/internationalization/src/routing";
import {
  createLocalizedAlternates,
  createResolvedRouteAlternates,
} from "@/lib/seo/alternates";
import {
  testArticleDeProjection,
  testArticleIdProjection,
  testArticleProjection,
} from "@/test/content-article";

describe("createLocalizedAlternates", () => {
  it("keeps projected route alternates out of template-only locale middleware", () => {
    expect(routing.alternateLinks).toBe(false);
  });

  it("builds canonical, locale, default, and markdown alternates", () => {
    const result = createLocalizedAlternates("/id/articles/politics/example", {
      types: {
        "text/markdown": "/id/articles/politics/example.md",
      },
    });

    expect(result).toEqual({
      canonical: "/id/articles/politics/example",
      languages: {
        de: "/de/articles/politics/example",
        en: "/en/articles/politics/example",
        id: "/id/articles/politics/example",
        "x-default": "/en/articles/politics/example",
      },
      types: {
        "text/markdown": "/id/articles/politics/example.md",
      },
    });
  });

  it("normalizes paths without a leading slash", () => {
    const result = createLocalizedAlternates("en/articles/politics/example");

    expect(result).toEqual({
      canonical: "/en/articles/politics/example",
      languages: {
        de: "/de/articles/politics/example",
        en: "/en/articles/politics/example",
        id: "/id/articles/politics/example",
        "x-default": "/en/articles/politics/example",
      },
    });
  });

  it("handles locale root paths", () => {
    const result = createLocalizedAlternates("/id");

    expect(result).toEqual({
      canonical: "/id",
      languages: {
        de: "/de",
        en: "/en",
        id: "/id",
        "x-default": "/en",
      },
    });
  });

  it("publishes every active locale from the routing contract", () => {
    const result = createLocalizedAlternates("/de/privacy-policy");

    expect(result).toEqual({
      canonical: "/de/privacy-policy",
      languages: {
        de: "/de/privacy-policy",
        en: "/en/privacy-policy",
        id: "/id/privacy-policy",
        "x-default": "/en/privacy-policy",
      },
    });
  });

  it("keeps unlocalized paths as the shared route path", () => {
    const result = createLocalizedAlternates("/robots.txt");

    expect(result).toEqual({
      canonical: "/robots.txt",
      languages: {
        de: "/de/robots.txt",
        en: "/en/robots.txt",
        id: "/id/robots.txt",
        "x-default": "/en/robots.txt",
      },
    });
  });

  it("uses the default locale path when custom alternates omit x-default", () => {
    const result = createLocalizedAlternates("/id/materi/matematika", {
      languages: {
        id: "/id/materi/matematika",
      },
    });

    expect(result.languages).toEqual({
      id: "/id/materi/matematika",
      "x-default": "/en/materi/matematika",
    });
  });

  it("builds hreflang values from already-resolved route counterparts", () => {
    expect(
      createResolvedRouteAlternates(
        { appLocale: "id", publicPath: "kurikulum/merdeka" },
        [
          { appLocale: "en", publicPath: "curriculum/merdeka" },
          { appLocale: "id", publicPath: "kurikulum/merdeka" },
          { appLocale: "de", publicPath: "lehrplaene/merdeka" },
        ]
      )
    ).toMatchObject({
      canonical: "/id/kurikulum/merdeka",
      languages: {
        de: "/de/lehrplaene/merdeka",
        en: "/en/curriculum/merdeka",
        id: "/id/kurikulum/merdeka",
      },
    });
  });

  it("keeps x-default on an existing resolved locale route", () => {
    expect(
      createResolvedRouteAlternates(
        { appLocale: "id", publicPath: "materi/matematika/fungsi/konsep" },
        [
          {
            appLocale: "id",
            publicPath: "materi/matematika/fungsi/konsep",
          },
        ]
      )
    ).toMatchObject({
      languages: {
        id: "/id/materi/matematika/fungsi/konsep",
        "x-default": "/id/materi/matematika/fungsi/konsep",
      },
    });
  });

  it("builds the same reciprocal language set from every article counterpart", () => {
    const counterparts = [
      testArticleProjection,
      testArticleIdProjection,
      testArticleDeProjection,
    ];
    const expectedLanguages = {
      de: `/${testArticleDeProjection.appLocale}/${testArticleDeProjection.publicPath}`,
      en: `/${testArticleProjection.appLocale}/${testArticleProjection.publicPath}`,
      id: `/${testArticleIdProjection.appLocale}/${testArticleIdProjection.publicPath}`,
      "x-default": `/${testArticleProjection.appLocale}/${testArticleProjection.publicPath}`,
    };

    for (const counterpart of counterparts) {
      expect(
        createResolvedRouteAlternates(counterpart, counterparts).languages
      ).toEqual(expectedLanguages);
    }
  });
});
