import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Option } from "effect";
import { createSeoHead, toRouterHead } from "@/lib/seo/head";

const facts = {
  canonicalPath: "/en/materials/aljabar",
  description: "Pengantar aljabar dasar.",
  image: "/en/og/materials/aljabar/image.png",
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

  it("uses an absolute title as it is, without the site suffix", () => {
    const head = createSeoHead({
      ...facts,
      absoluteTitle: "Harga Nakafa Pro",
      parts: [],
    });
    expect(head.title).toBe("Harga Nakafa Pro");
    expect(head.social["og:title"]).toBe("Harga Nakafa Pro");
  });

  it("lists every locale and x-default from the route map", () => {
    expect(createSeoHead(facts).alternates).toStrictEqual([
      { hreflang: "en", href: "https://nakafa.com/en/subjects/aljabar" },
      { hreflang: "id", href: "https://nakafa.com/id/materi/aljabar" },
      { hreflang: "de", href: "https://nakafa.com/de/faecher/aljabar" },
      { hreflang: "x-default", href: "https://nakafa.com/en/subjects/aljabar" },
    ]);
  });

  it("keeps the image address of a page in its own locale", () => {
    const head = createSeoHead({
      ...facts,
      canonicalPath: "/de/materials/aljabar",
      image: "/de/og/materials/aljabar/image.png",
      locale: "de",
    });
    expect(head.social["og:image"]).toBe(
      "https://nakafa.com/de/og/materials/aljabar/image.png"
    );
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

  it("names one social image, with its address, alt text and size", () => {
    const social = createSeoHead(facts).social;
    const image = "https://nakafa.com/en/og/materials/aljabar/image.png";
    expect(social["og:image"]).toBe(image);
    expect(social["twitter:image"]).toBe(image);
    expect(social["og:image:alt"]).toBe("Aljabar Dasar - Matematika - Nakafa");
    expect(social["twitter:image:alt"]).toBe(social["og:image:alt"]);
    expect(social["og:image:width"]).toBe("1200");
    expect(social["og:image:height"]).toBe("630");
  });

  it("names the site account as the Twitter site and creator", () => {
    const social = createSeoHead(facts).social;
    expect(social["twitter:site"]).toBe("@nabilfatih_");
    expect(social["twitter:creator"]).toBe("@nabilfatih_");
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
