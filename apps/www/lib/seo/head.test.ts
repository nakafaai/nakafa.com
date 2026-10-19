import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Option } from "effect";
import { createSeoHead, toRouterHead } from "@/lib/seo/head";

const facts = {
  canonicalPath: "/en/materials/aljabar",
  description: "Pengantar aljabar dasar.",
  indexable: true,
  jsonLd: [{ "@type": "Article" }],
  locale: "en",
  parts: ["Aljabar Dasar", "Matematika"],
  type: "article",
} as const;

describe("page head", () => {
  it("titles, describes and points the page at its canonical address", () => {
    const head = createSeoHead(facts);
    expect(head.title).toBe("Aljabar Dasar - Matematika - Nakafa");
    expect(head.canonical).toBe("https://nakafa.com/en/subjects/aljabar");
    expect(head.robots).toBe("index,follow");
  });

  it("lists every locale and x-default from the route map", () => {
    expect(createSeoHead(facts).alternates).toStrictEqual([
      { hreflang: "en", href: "https://nakafa.com/en/subjects/aljabar" },
      { hreflang: "id", href: "https://nakafa.com/id/materi/aljabar" },
      { hreflang: "de", href: "https://nakafa.com/de/faecher/aljabar" },
      { hreflang: "x-default", href: "https://nakafa.com/en/subjects/aljabar" },
    ]);
  });

  it("keeps an unindexable page out of the index", () => {
    expect(createSeoHead({ ...facts, indexable: false }).robots).toBe(
      "noindex,nofollow"
    );
  });

  it("carries the social entries with the canonical address", () => {
    const social = createSeoHead(facts).social;
    expect(social["og:url"]).toBe("https://nakafa.com/en/subjects/aljabar");
    expect(social["og:site_name"]).toBe("Nakafa");
    expect(social["twitter:card"]).toBe("summary_large_image");
  });
});

describe("router head", () => {
  it("maps the canonical link, the alternates and the meta entries in order", () => {
    const routed = toRouterHead(createSeoHead(facts));
    expect(routed.links[0]).toStrictEqual({
      href: "https://nakafa.com/en/subjects/aljabar",
      rel: "canonical",
    });
    expect(
      Arr.map(Arr.drop(routed.links, 1), (link) => link.rel)
    ).toStrictEqual(["alternate", "alternate", "alternate", "alternate"]);
    expect(Arr.take(routed.meta, 3)).toStrictEqual([
      { title: "Aljabar Dasar - Matematika - Nakafa" },
      { content: "Pengantar aljabar dasar.", name: "description" },
      { content: "index,follow", name: "robots" },
    ]);
    expect(routed.meta).toContainEqual({
      content: "article",
      property: "og:type",
    });
    expect(routed.meta).toContainEqual({
      content: "summary_large_image",
      name: "twitter:card",
    });
    expect(Arr.last(routed.meta)).toStrictEqual(
      Option.some({ "script:ld+json": { "@type": "Article" } })
    );
  });
});
