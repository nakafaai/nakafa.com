// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import { readPageFacts } from "@/lib/seo/audit/html";
import { PAGE_PATH, writePage } from "@/lib/seo/audit/test.page";

describe("readPageFacts", () => {
  it("reads every fact a crawler reads in the page, its entities read back", () => {
    const facts = readPageFacts(
      writePage({
        body: '<nav data-slot="breadcrumb"><a data-slot="breadcrumb-link" href="/id/home">Beranda</a><span data-slot="breadcrumb-page">Al-Qur&#x27;an<!-- --> &amp; Tafsir</span></nav><h1>Rotasi</h1><span class="katex"><span class="katex-mathml">x</span></span><span class="katex"><span class="katex-mathml" data-nosnippet="">y</span></span>',
        title: ["Al-Qur&#x27;an &amp; &quot;Tafsir&quot; &lt;3&gt;"],
      })
    );

    expect(facts).toStrictEqual({
      alternates: [
        { href: `https://nakafa.com${PAGE_PATH}`, hreflang: "id" },
        {
          href: "https://nakafa.com/en/subjects/mathematics/rotation",
          hreflang: "en",
        },
        {
          href: "https://nakafa.com/en/subjects/mathematics/rotation",
          hreflang: "x-default",
        },
      ],
      canonicals: [`https://nakafa.com${PAGE_PATH}`],
      descriptions: ["Putar titik dan grafik fungsi terhadap titik asal."],
      headings: 1,
      jsonLd: [expect.stringContaining('"BreadcrumbList"')],
      openMathCopies: 1,
      robots: ["index,follow,max-snippet:-1,max-image-preview:large"],
      titles: ['Al-Qur\'an & "Tafsir" <3>'],
      trails: [
        [
          { href: Option.some("/id/home"), label: "Beranda" },
          { href: Option.none(), label: "Al-Qur'an & Tafsir" },
        ],
      ],
    });
  });

  it("reads nothing from a document without a head", () => {
    expect(readPageFacts("<html><body></body></html>")).toStrictEqual({
      alternates: [],
      canonicals: [],
      descriptions: [],
      headings: 0,
      jsonLd: [],
      openMathCopies: 0,
      robots: [],
      titles: [],
      trails: [],
    });
  });
});
