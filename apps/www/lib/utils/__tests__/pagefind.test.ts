import { normalizeLocalizedInternalHref } from "@repo/internationalization/src/href";
import { describe, expect, it } from "vitest";
import { getPagefindSubResultHref, normalizePagefindResult } from "../pagefind";

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
});
