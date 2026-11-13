// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { readPageFacts } from "@/lib/seo/audit/html";
import { auditPage, isIndexable } from "@/lib/seo/audit/page";
import {
  breadcrumbText,
  crumb,
  PAGE_PATH,
  TRAIL,
  writePage,
} from "@/lib/seo/audit/test.page";

const PAGE_URL = `https://nakafa.com${PAGE_PATH}`;

/** The problems of the test page with `parts` changed, without the path each one starts with. */
function problemsOf(parts: Parameters<typeof writePage>[0], path = PAGE_PATH) {
  return auditPage(path, readPageFacts(writePage(parts))).problems;
}

describe("auditPage", () => {
  it("passes a page that keeps the whole contract, and reports what it names", () => {
    expect(auditPage(PAGE_PATH, readPageFacts(writePage()))).toStrictEqual({
      alternates: [
        PAGE_URL,
        "https://nakafa.com/en/subjects/mathematics/rotation",
      ],
      canonical: PAGE_URL,
      crumbs: [
        "https://nakafa.com/id",
        "https://nakafa.com/id/kurikulum/merdeka",
      ],
      description: "Putar titik dan grafik fungsi terhadap titik asal.",
      problems: [],
      title: "Rotasi - Nakafa",
    });
  });

  it.each([
    ["no title", { title: [] }, "0 title entries, needs 1"],
    ["two titles", { title: ["A", "B"] }, "2 title entries, needs 1"],
    ["no description", { description: [] }, "0 description entries, needs 1"],
    [
      "an empty description",
      { description: [" "] },
      "the description is empty",
    ],
    [
      "two robots rules",
      { robots: ["index", "index"] },
      "2 robots entries, needs 1",
    ],
    [
      "a canonical link to another page",
      { canonical: ["https://nakafa.com/id"] },
      `the canonical link is not ${PAGE_URL}`,
    ],
    [
      "no alternate for the page itself",
      { alternates: [["x-default", "https://nakafa.com/id"]] },
      "no alternate names the page",
    ],
    [
      "no x-default alternate",
      { alternates: [["id", PAGE_URL]] },
      "no x-default alternate",
    ],
    [
      "a repeated hreflang",
      {
        alternates: [
          ["id", PAGE_URL],
          ["id", PAGE_URL],
          ["x-default", PAGE_URL],
        ],
      },
      "an hreflang repeats",
    ],
    [
      "an alternate on another site",
      {
        alternates: [
          ["id", PAGE_URL],
          ["en", "https://example.com/rotation"],
          ["x-default", PAGE_URL],
        ],
      },
      "the alternate https://example.com/rotation leaves the site",
    ],
    [
      "two h1 headings",
      { body: "<h1>A</h1><h1>B</h1>" },
      "2 h1 headings, needs 1",
    ],
    [
      "a formula whose MathML copy a snippet could quote",
      { body: '<h1>A</h1><span class="katex-mathml">x</span>' },
      "1 formulas open their MathML copy to snippets",
    ],
    [
      "JSON-LD that is no JSON",
      { jsonLd: ["{", breadcrumbText(TRAIL)] },
      "a JSON-LD script is no JSON",
    ],
    [
      "a node without a type",
      { jsonLd: ['{"name":"Nakafa"}', breadcrumbText(TRAIL)] },
      "a JSON-LD node names no @type",
    ],
    ["no breadcrumb", { jsonLd: ['{"@type":"WebSite"}'] }, "no BreadcrumbList"],
    [
      "a breadcrumb without placed crumbs",
      { jsonLd: [breadcrumbText([{ name: "Beranda" }])] },
      "a BreadcrumbList is not a list of named, placed crumbs",
    ],
    [
      "a one-crumb breadcrumb",
      {
        body: "<h1>A</h1>",
        jsonLd: [breadcrumbText([crumb(1, "Rotasi", PAGE_PATH)])],
      },
      "the breadcrumb has fewer than two crumbs",
    ],
    [
      "a breadcrumb that skips a place",
      {
        jsonLd: [
          breadcrumbText([
            crumb(1, "Beranda", "/id"),
            crumb(3, "Rotasi", PAGE_PATH),
          ]),
        ],
      },
      "the breadcrumb does not count its crumbs from 1",
    ],
    [
      "a crumb on another site",
      {
        jsonLd: [
          breadcrumbText([
            { ...crumb(1, "Beranda", "/id"), item: "https://example.com/id" },
            crumb(2, "Rotasi", PAGE_PATH),
          ]),
        ],
      },
      "the crumb Beranda leaves the site: https://example.com/id",
    ],
    [
      "a breadcrumb that ends at another page",
      {
        body: "<h1>A</h1>",
        jsonLd: [
          breadcrumbText([
            crumb(1, "Beranda", "/id"),
            crumb(2, "Materi", "/id/materi"),
          ]),
        ],
      },
      "the breadcrumb does not end at the page",
    ],
    [
      "a visible breadcrumb through a page that no trail names",
      {
        body: '<nav data-slot="breadcrumb"><a data-slot="breadcrumb-link" href="/id/home">Beranda</a><a data-slot="breadcrumb-link" href="/id/kurikulum/kssm">KSSM</a></nav><h1>A</h1>',
      },
      "the visible breadcrumb Beranda > KSSM leads through pages that no BreadcrumbList names",
    ],
  ] as const)("reports %s", (_, parts, problem) => {
    expect(problemsOf(parts)).toStrictEqual([`${PAGE_PATH}: ${problem}`]);
  });

  it("reads a visible crumb that links a section of a page as that page, and one without a link as the page itself", () => {
    expect(
      problemsOf({
        body: '<nav data-slot="breadcrumb"><a data-slot="breadcrumb-link" href="/id/home">Beranda</a><a data-slot="breadcrumb-link" href="/id/kurikulum/merdeka#rotasi">Transformasi</a><span data-slot="breadcrumb-page">Rotasi</span></nav><h1>A</h1>',
      })
    ).toStrictEqual([]);
  });

  it("matches no trail with a visible crumb that leaves the site", () => {
    expect(
      problemsOf({
        body: '<nav data-slot="breadcrumb"><a data-slot="breadcrumb-link" href="/id/home">Beranda</a><a data-slot="breadcrumb-link" href="https://example.com/x">Luar</a></nav><h1>A</h1>',
      })
    ).toStrictEqual([
      `${PAGE_PATH}: the visible breadcrumb Beranda > Luar leads through pages that no BreadcrumbList names`,
    ]);
  });

  it("reports main content that ends past the bytes Googlebot fetches", () => {
    const facts = readPageFacts(writePage());

    expect(
      auditPage(PAGE_PATH, { ...facts, contentBytes: 2_000_001 }).problems
    ).toStrictEqual([
      `${PAGE_PATH}: the main content ends at byte 2000001, past the 2000000 that Googlebot fetches`,
    ]);
  });

  it("reads the breadcrumb of a document that holds several nodes, as an article's does", () => {
    expect(
      problemsOf({ jsonLd: [`[{"@type":"Article"},${breadcrumbText(TRAIL)}]`] })
    ).toStrictEqual([]);
  });

  it("matches each visible breadcrumb with any of the page's trails", () => {
    expect(
      problemsOf({
        body: '<nav data-slot="breadcrumb"><a data-slot="breadcrumb-link" href="/id/home">Beranda</a><a data-slot="breadcrumb-link" href="/id/kurikulum/kssm">KSSM</a></nav><h1>A</h1>',
        jsonLd: [
          breadcrumbText(TRAIL),
          breadcrumbText([
            crumb(1, "Beranda", "/id"),
            crumb(2, "KSSM", "/id/kurikulum/kssm"),
            crumb(3, "Rotasi", PAGE_PATH),
          ]),
        ],
      })
    ).toStrictEqual([]);
  });

  it("asks no breadcrumb of a locale's root, where every trail starts", () => {
    expect(
      problemsOf(
        {
          body: "<h1>Nakafa</h1>",
          jsonLd: ['{"@type":"WebSite"}'],
          path: "/id",
        },
        "/id"
      )
    ).toStrictEqual([]);
  });
});

describe("isIndexable", () => {
  it("reads the robots rule of the page", () => {
    expect(isIndexable(readPageFacts(writePage()))).toBe(true);
    expect(
      isIndexable(readPageFacts(writePage({ robots: ["noindex,nofollow"] })))
    ).toBe(false);
  });
});
