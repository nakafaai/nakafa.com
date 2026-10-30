// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { Array as Arr, Effect } from "effect";
import { readSitemapFiles } from "@/lib/sitemap/files";

const descriptorsMock = vi.hoisted(() => vi.fn());
const entriesMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/sitemap/catalog", () => ({
  /** Controls the sitemap pages that the active release lists. */
  readSitemapPageDescriptors: descriptorsMock,
}));

vi.mock("@/lib/sitemap/entries", () => ({
  /** Controls the URLs of one sitemap page. */
  getSitemapEntries: entriesMock,
}));

describe("sitemap files", () => {
  it.effect(
    "writes the index that names each page, and each page at the address that the index names",
    () =>
      Effect.gen(function* () {
        descriptorsMock.mockReturnValue(
          Effect.succeed([{ id: "base" }, { id: "article_en_p0" }])
        );
        entriesMock.mockImplementation(({ pageId }: { pageId: string }) =>
          Effect.succeed([{ url: `${SITE_ORIGIN}/${pageId}` }])
        );

        const files = yield* readSitemapFiles();

        expect(Arr.map(files, (file) => file.path)).toEqual([
          "sitemap.xml",
          "sitemap/base.xml",
          "sitemap/article_en_p0.xml",
        ]);
        const [index, base] = files;
        expect(index?.text).toContain(
          `<loc>${SITE_ORIGIN}/sitemap/base.xml</loc>`
        );
        expect(index?.text).toContain(
          `<loc>${SITE_ORIGIN}/sitemap/article_en_p0.xml</loc>`
        );
        expect(base?.text).toContain(`<loc>${SITE_ORIGIN}/base</loc>`);
      })
  );

  it.effect(
    "lists the try-out pages that the build writes, and not the search screen",
    () =>
      Effect.gen(function* () {
        descriptorsMock.mockReturnValue(Effect.succeed([{ id: "quran_en" }]));
        entriesMock.mockReturnValue(
          Effect.succeed([
            { url: `${SITE_ORIGIN}/en/quran/1` },
            { url: `${SITE_ORIGIN}/en/search` },
            { url: `${SITE_ORIGIN}/en/try-out/indonesia/snbt/2027` },
            {
              url: `${SITE_ORIGIN}/en/try-out/indonesia/snbt/2027/set-1`,
            },
          ])
        );

        const [page] = yield* readSitemapFiles().pipe(Effect.map(Arr.drop(1)));

        expect(page?.text).toContain(`<loc>${SITE_ORIGIN}/en/quran/1</loc>`);
        expect(page?.text).toContain(
          `<loc>${SITE_ORIGIN}/en/try-out/indonesia/snbt/2027/set-1</loc>`
        );
        expect(page?.text).not.toContain("/en/search");
      })
  );
});
