// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import { readPageFacts } from "@/lib/seo/audit/html";
import { auditSite } from "@/lib/seo/audit/site";
import {
  breadcrumbText,
  crumb,
  PAGE_PATH,
  writePage,
} from "@/lib/seo/audit/test.page";

const EN_PATH = "/en/subjects/mathematics/rotation";

/** The trail of the English counterpart of the test page. */
const EN_TRAIL = [crumb(1, "Home", "/en"), crumb(2, "Rotation", EN_PATH)];

/** One locale's root, which every crumb of that locale starts at. */
function root(locale: string, title: string) {
  return {
    facts: readPageFacts(
      writePage({
        alternates: [
          [locale, `https://nakafa.com/${locale}`],
          ["x-default", `https://nakafa.com/${locale}`],
        ],
        body: `<h1>${title}</h1>`,
        description: [`${title} description`],
        jsonLd: [],
        path: `/${locale}`,
        title: [title],
      })
    ),
    path: `/${locale}`,
  };
}

/** The English counterpart of the test page, which names it back unless a test changes that. */
function english(parts: Parameters<typeof writePage>[0] = {}) {
  return {
    facts: readPageFacts(
      writePage({
        alternates: [
          ["id", `https://nakafa.com${PAGE_PATH}`],
          ["en", `https://nakafa.com${EN_PATH}`],
          ["x-default", `https://nakafa.com${EN_PATH}`],
        ],
        body: "<h1>Rotation</h1>",
        jsonLd: [breadcrumbText(EN_TRAIL)],
        path: EN_PATH,
        title: ["Rotation - Nakafa"],
        ...parts,
      })
    ),
    path: EN_PATH,
  };
}

/** A site of both locales' roots, the curriculum page the trail names, the test page and its counterpart. */
function site() {
  return [
    root("id", "Nakafa"),
    root("en", "Nakafa"),
    {
      facts: readPageFacts(
        writePage({
          alternates: [
            ["id", "https://nakafa.com/id/kurikulum/merdeka"],
            ["x-default", "https://nakafa.com/id/kurikulum/merdeka"],
          ],
          body: "<h1>Kurikulum Merdeka</h1>",
          description: ["Kurikulum Merdeka di Nakafa."],
          jsonLd: [
            breadcrumbText([
              crumb(1, "Beranda", "/id"),
              crumb(2, "Kurikulum Merdeka", "/id/kurikulum/merdeka"),
            ]),
          ],
          path: "/id/kurikulum/merdeka",
          title: ["Kurikulum Merdeka - Nakafa"],
        })
      ),
      path: "/id/kurikulum/merdeka",
    },
    { facts: readPageFacts(writePage()), path: PAGE_PATH },
    english(),
  ];
}

const SITEMAP = Arr.map(site(), (page) => page.path);

describe("auditSite", () => {
  it("passes a site whose pages keep the contract and link each other", () => {
    expect(auditSite(site(), SITEMAP)).toStrictEqual([]);
  });

  it("leaves a page that is no index to its robots rule", () => {
    const pages = [
      ...site(),
      {
        facts: readPageFacts(
          writePage({ robots: ["noindex,nofollow"], title: [] })
        ),
        path: `${PAGE_PATH}/bagian`,
      },
    ];

    expect(auditSite(pages, SITEMAP)).toStrictEqual([]);
  });

  it("reports a sitemap page that the build did not write as indexable", () => {
    expect(auditSite(site(), [...SITEMAP, "/id/hilang"])).toStrictEqual([
      "/id/hilang: the sitemap lists a page the build did not write as indexable",
    ]);
  });

  it("reports pages of one locale that share a title or a description, and not pages of two", () => {
    const pages = Arr.map(site(), (page) =>
      page.path === "/id/kurikulum/merdeka"
        ? {
            ...page,
            facts: {
              ...page.facts,
              descriptions: [
                "Putar titik dan grafik fungsi terhadap titik asal.",
              ],
              titles: ["Rotasi - Nakafa"],
            },
          }
        : page
    );

    expect(auditSite(pages, SITEMAP)).toStrictEqual([
      `/id/kurikulum/merdeka, ${PAGE_PATH}: these pages share the title "Rotasi - Nakafa"`,
      `/id/kurikulum/merdeka, ${PAGE_PATH}: these pages share the description "Putar titik dan grafik fungsi terhadap titik asal."`,
    ]);
  });

  it("reports an alternate that does not name the page back, and one that leaves the site", () => {
    const pages = [
      ...Arr.filter(site(), (page) => page.path !== EN_PATH),
      english({
        alternates: [
          ["en", `https://nakafa.com${EN_PATH}`],
          ["de", "https://example.com/de/rotation"],
          ["x-default", `https://nakafa.com${EN_PATH}`],
        ],
      }),
    ];

    expect(auditSite(pages, SITEMAP)).toStrictEqual([
      `${EN_PATH}: the alternate https://example.com/de/rotation leaves the site`,
      `${PAGE_PATH}: the alternate https://nakafa.com${EN_PATH} does not name the page back`,
      `${EN_PATH}: the alternate https://example.com/de/rotation is no indexable page`,
    ]);
  });

  it("reports a crumb that leads to no indexable page", () => {
    const pages = Arr.filter(
      site(),
      (page) => page.path !== "/id/kurikulum/merdeka"
    );

    expect(
      auditSite(
        pages,
        Arr.filter(SITEMAP, (path) => path !== "/id/kurikulum/merdeka")
      )
    ).toStrictEqual([
      `${PAGE_PATH}: the crumb https://nakafa.com/id/kurikulum/merdeka is no indexable page`,
    ]);
  });
});
