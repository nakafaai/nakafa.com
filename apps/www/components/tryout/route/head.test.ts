import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import { createTryoutHead } from "@/components/tryout/route/head";

const page = {
  canonicalPath: "/en/try-out/indonesia",
  description: "Latihan soal",
  image: "https://nakafa.com/og/try-out.png",
  locale: "en",
  title: "Indonesia",
} as const;

describe("createTryoutHead", () => {
  it("names the page title and lets search engines index a catalog page", () => {
    const head = createTryoutHead({ ...page, indexable: true, jsonLd: [] });

    expect(head.meta).toContainEqual({
      title: expect.stringContaining("Indonesia"),
    });
    expect(head.meta).toContainEqual({
      content: "index,follow",
      name: "robots",
    });
    expect(head.meta).toContainEqual({
      content: "Latihan soal",
      name: "description",
    });
  });

  it("keeps an attempt page out of search results", () => {
    const head = createTryoutHead({ ...page, indexable: false, jsonLd: [] });

    expect(head.meta).toContainEqual({
      content: "noindex,nofollow",
      name: "robots",
    });
  });

  it("emits the canonical link first and then the JSON-LD nodes in order", () => {
    const first = { "@type": "BreadcrumbList" };
    const second = { "@type": "WebPage" };
    const head = createTryoutHead({
      ...page,
      indexable: true,
      jsonLd: [first, second],
    });

    expect(head.links[0]).toEqual({
      href: "https://nakafa.com/en/try-out/indonesia",
      rel: "canonical",
    });
    const scripts = Arr.filter(head.meta, (entry) => "script:ld+json" in entry);
    expect(scripts).toEqual([
      { "script:ld+json": first },
      { "script:ld+json": second },
    ]);
  });
});
