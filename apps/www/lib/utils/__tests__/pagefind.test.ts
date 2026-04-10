import { normalizeLocalizedInternalHref } from "@repo/internationalization/src/href";
import { describe, expect, it } from "vitest";
import {
  getPagefindSectionResults,
  getPagefindSubResultHref,
  hasPagefindExcerpt,
  normalizePagefindResult,
} from "../pagefind";

describe("normalizeLocalizedInternalHref", () => {
  it("strips the leading locale from internal hrefs", () => {
    expect(
      normalizeLocalizedInternalHref("/id/subject/high-school/10/mathematics")
    ).toBe("/subject/high-school/10/mathematics");
  });

  it("preserves query and hash after locale stripping", () => {
    expect(normalizeLocalizedInternalHref("/id/search?q=log#hasil")).toBe(
      "/search?q=log#hasil"
    );
  });

  it("leaves external urls untouched", () => {
    expect(
      normalizeLocalizedInternalHref("https://example.com/id/subject")
    ).toBe("https://example.com/id/subject");
  });
});

describe("getPagefindSubResultHref", () => {
  it("rebuilds the href from the anchor id instead of keeping malformed hashes", () => {
    expect(
      getPagefindSubResultHref({
        anchor: {
          element: "h3",
          id: "definisi-formal-logaritma",
          location: 10,
          text: "Definisi Formal Logaritma",
        },
        excerpt: "...",
        title: "Definisi Formal Logaritma",
        url: "/id/subject/high-school/10/mathematics/exponential-logarithm/logarithm-definition#pengertian-logaritma#definisi-formal-logaritma",
      })
    ).toBe(
      "/subject/high-school/10/mathematics/exponential-logarithm/logarithm-definition#definisi-formal-logaritma"
    );
  });

  it("returns the normalized href as-is when no anchor id exists", () => {
    expect(
      getPagefindSubResultHref({
        excerpt: "...",
        title: "Logaritma",
        url: "/id/subject/high-school/10/mathematics/exponential-logarithm/logarithm-definition.html",
      })
    ).toBe(
      "/subject/high-school/10/mathematics/exponential-logarithm/logarithm-definition"
    );
  });

  it("adds the anchor hash even when the source href has no hash yet", () => {
    expect(
      getPagefindSubResultHref({
        anchor: {
          element: "h2",
          id: "pengertian-logaritma",
          location: 1,
          text: "Pengertian Logaritma",
        },
        excerpt: "...",
        title: "Pengertian Logaritma",
        url: "/id/subject/high-school/10/mathematics/exponential-logarithm/logarithm-definition.html",
      })
    ).toBe(
      "/subject/high-school/10/mathematics/exponential-logarithm/logarithm-definition#pengertian-logaritma"
    );
  });
});

describe("normalizePagefindResult", () => {
  it("normalizes both result and sub-result hrefs for app navigation", () => {
    expect(
      normalizePagefindResult({
        excerpt: "...",
        meta: {
          title: "Matematika",
        },
        raw_url:
          "/id/subject/high-school/10/mathematics/exponential-logarithm/logarithm-definition.html",
        sub_results: [
          {
            anchor: {
              element: "h2",
              id: "pengertian-logaritma",
              location: 1,
              text: "Pengertian Logaritma",
            },
            excerpt: "...",
            title: "Pengertian Logaritma",
            url: "/id/subject/high-school/10/mathematics/exponential-logarithm/logarithm-definition.html#pengertian-logaritma",
          },
        ],
        url: "/id/subject/high-school/10/mathematics/exponential-logarithm/logarithm-definition.html",
      }).sub_results[0]?.url
    ).toBe(
      "/subject/high-school/10/mathematics/exponential-logarithm/logarithm-definition#pengertian-logaritma"
    );
  });

  it("removes repeated section titles from sub-result excerpts", () => {
    expect(
      normalizePagefindResult({
        excerpt: "...",
        meta: {
          title: "Matematika",
        },
        raw_url:
          "/id/subject/high-school/10/mathematics/exponential-logarithm/logarithm-definition.html",
        sub_results: [
          {
            anchor: {
              element: "h2",
              id: "pengertian-logaritma",
              location: 1,
              text: "Pengertian Logaritma",
            },
            excerpt:
              "Pengertian <mark>Logaritma.</mark> <mark>Logaritma</mark> adalah operasi matematika...",
            title: "Pengertian Logaritma",
            url: "/id/subject/high-school/10/mathematics/exponential-logarithm/logarithm-definition.html#pengertian-logaritma",
          },
        ],
        url: "/id/subject/high-school/10/mathematics/exponential-logarithm/logarithm-definition.html",
      }).sub_results[0]?.excerpt
    ).toBe("<mark>Logaritma</mark> adalah operasi matematika...");
  });
});

describe("getPagefindSectionResults", () => {
  it("drops a duplicate title row when anchored section hits exist", () => {
    const result = getPagefindSectionResults({
      excerpt: "...",
      meta: { title: "Definisi Logaritma" },
      raw_url: "/id/subject/logarithm-definition.html",
      sub_results: [
        {
          excerpt: "Ringkasan...",
          title: "Definisi Logaritma",
          url: "/id/subject/logarithm-definition.html",
        },
        {
          anchor: {
            element: "h2",
            id: "pengertian-logaritma",
            location: 1,
            text: "Pengertian Logaritma",
          },
          excerpt: "Isi...",
          title: "Pengertian Logaritma",
          url: "/id/subject/logarithm-definition.html#pengertian-logaritma",
        },
      ],
      url: "/id/subject/logarithm-definition.html",
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe("Pengertian Logaritma");
  });

  it("keeps the first item clickable when no section hits exist", () => {
    const result = getPagefindSectionResults({
      excerpt: "...",
      meta: { title: "Set 1" },
      raw_url: "/id/exercises/set-1.html",
      sub_results: [
        {
          excerpt: "Ringkasan...",
          title: "Set 1",
          url: "/id/exercises/set-1.html",
        },
      ],
      url: "/id/exercises/set-1.html",
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe("Set 1");
  });
});

describe("hasPagefindExcerpt", () => {
  it("returns false for empty excerpt markup", () => {
    expect(hasPagefindExcerpt("<mark></mark>")).toBe(false);
  });

  it("returns true when excerpt contains visible text", () => {
    expect(hasPagefindExcerpt("<mark>Logaritma</mark> adalah operasi")).toBe(
      true
    );
  });
});
