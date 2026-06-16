// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createLocalizedAlternates } from "@/lib/utils/seo/alternates";

describe("createLocalizedAlternates", () => {
  it("builds canonical, locale, default, and markdown alternates", () => {
    const result = createLocalizedAlternates("/id/articles/politics/example", {
      types: {
        "text/markdown": "/id/articles/politics/example.md",
      },
    });

    expect(result).toEqual({
      canonical: "/id/articles/politics/example",
      languages: {
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
    const result = createLocalizedAlternates(
      "en/curriculum/high-school/11/mathematics"
    );

    expect(result).toEqual({
      canonical: "/en/curriculum/high-school/11/mathematics",
      languages: {
        en: "/en/curriculum/high-school/11/mathematics",
        id: "/id/curriculum/high-school/11/mathematics",
        "x-default": "/en/curriculum/high-school/11/mathematics",
      },
    });
  });

  it("handles locale root paths", () => {
    const result = createLocalizedAlternates("/id");

    expect(result).toEqual({
      canonical: "/id",
      languages: {
        en: "/en",
        id: "/id",
        "x-default": "/en",
      },
    });
  });

  it("keeps unlocalized paths as the shared route path", () => {
    const result = createLocalizedAlternates("/robots.txt");

    expect(result).toEqual({
      canonical: "/robots.txt",
      languages: {
        en: "/en/robots.txt",
        id: "/id/robots.txt",
        "x-default": "/en/robots.txt",
      },
    });
  });
});
