import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Option } from "effect";
import {
  createPrivateSeoHead,
  createSeoHead,
  toHeadAlternates,
  toRouterHead,
} from "@/lib/seo/head";

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
    expect(head.robots).toBe(
      "index,follow,max-snippet:-1,max-image-preview:large"
    );
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

describe("page googlebot rule", () => {
  it("names the image and snippet limits that Google reads on an indexable page", () => {
    expect(createSeoHead(facts).googlebot).toBe(
      "index,follow,max-video-preview:-1,max-image-preview:large,max-snippet:-1"
    );
    expect(toRouterHead(createSeoHead(facts)).meta).toContainEqual({
      content:
        "index,follow,max-video-preview:-1,max-image-preview:large,max-snippet:-1",
      name: "googlebot",
    });
  });

  it("keeps an unindexable page's image out of the index", () => {
    expect(createSeoHead({ ...facts, indexable: false }).googlebot).toBe(
      "noindex,nofollow,noimageindex"
    );
  });
});

describe("head alternates of a resolved route", () => {
  it("maps each locale and each representation to an absolute link, and skips a locale without a page", () => {
    expect(
      toHeadAlternates({
        languages: {
          de: undefined,
          en: "/en/materials/aljabar",
          id: "/id/materi/aljabar",
          "x-default": "/en/materials/aljabar",
        },
        types: {
          "text/markdown": "/en/materials/aljabar.md",
          "text/plain": undefined,
        },
      })
    ).toStrictEqual([
      { hreflang: "en", href: "https://nakafa.com/en/materials/aljabar" },
      { hreflang: "id", href: "https://nakafa.com/id/materi/aljabar" },
      {
        hreflang: "x-default",
        href: "https://nakafa.com/en/materials/aljabar",
      },
      {
        href: "https://nakafa.com/en/materials/aljabar.md",
        type: "text/markdown",
      },
    ]);
  });

  it("names no alternate for a route without languages or representations", () => {
    expect(toHeadAlternates({ languages: {} })).toStrictEqual([]);
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
      {
        content: "index,follow,max-snippet:-1,max-image-preview:large",
        name: "robots",
      },
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

describe("page head alternates", () => {
  it("uses the alternates that the content supplies in place of the route map's", () => {
    const alternates = [
      { hreflang: "en", href: "https://nakafa.com/en/materials/aljabar" },
      {
        href: "https://nakafa.com/en/materials/aljabar.md",
        type: "text/markdown",
      },
    ];

    expect(createSeoHead({ ...facts, alternates }).alternates).toStrictEqual(
      alternates
    );
  });

  it("names an alternate with only the attributes it carries", () => {
    const routed = toRouterHead(
      createSeoHead({
        ...facts,
        alternates: [
          {
            href: "https://nakafa.com/en/materials/aljabar.md",
            type: "text/markdown",
          },
        ],
      })
    );

    expect(routed.links).toStrictEqual([
      { href: "https://nakafa.com/en/subjects/aljabar", rel: "canonical" },
      {
        href: "https://nakafa.com/en/materials/aljabar.md",
        rel: "alternate",
        type: "text/markdown",
      },
    ]);
  });
});

describe("private page head", () => {
  const privateFacts = {
    description: "Halaman pribadi.",
    parts: ["Profil"],
  } as const;

  it("is indexable by no search engine and names no canonical address", () => {
    const head = createPrivateSeoHead(privateFacts);

    expect(head.robots).toBe("noindex,nofollow");
    expect(head.googlebot).toBe("noindex,nofollow,noimageindex");
    expect(head.canonical).toBeUndefined();
    expect(head.alternates).toStrictEqual([]);
    expect(head.social).toStrictEqual({});
    expect(head.title).toBe("Profil - Nakafa");
  });

  it("keeps an absolute title as it is, with no canonical link in the router head", () => {
    const routed = toRouterHead(
      createPrivateSeoHead({ ...privateFacts, absoluteTitle: "Nakafa Sekolah" })
    );

    expect(routed.links).toStrictEqual([]);
    expect(routed.meta[0]).toStrictEqual({ title: "Nakafa Sekolah" });
    expect(routed.meta[2]).toStrictEqual({
      content: "noindex,nofollow",
      name: "robots",
    });
  });
});
