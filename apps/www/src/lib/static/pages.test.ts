import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { readStaticPagePaths, selectStaticPagePaths } from "@/lib/static/pages";

const sitemap = vi.hoisted(() => ({
  descriptors: vi.fn(),
  entries: vi.fn(),
}));

vi.mock("@/lib/sitemap/catalog", () => ({
  /** Controls the sitemap pages that the active release lists. */
  readSitemapPageDescriptors: sitemap.descriptors,
}));

vi.mock("@/lib/sitemap/entries", () => ({
  /** Controls the canonical URLs of one sitemap page. */
  getSitemapEntries: sitemap.entries,
}));

describe("static page paths", () => {
  it("keeps the sitemap's public URLs and adds the articles and try-out indexes and the sign-in page of every locale", () => {
    const paths = selectStaticPagePaths({
      locales: ["en", "id"],
      sitemapPaths: [
        "/en/articles/politics/x",
        "/en/articles/politics",
        "/en/contributor",
        "/en/curriculum/merdeka",
        "/en/pricing",
        "/en/privacy-policy",
        "/en/quran/1",
        "/en/subjects/mathematics/algebra/linear",
        "/en/try-out/indonesia",
        "/en/try-out/indonesia/snbt",
        "/id/kurikulum/merdeka",
      ],
    });

    expect(paths).toEqual([
      "/en/articles",
      "/en/articles/politics",
      "/en/articles/politics/x",
      "/en/auth",
      "/en/contributor",
      "/en/curriculum/merdeka",
      "/en/pricing",
      "/en/privacy-policy",
      "/en/quran/1",
      "/en/subjects/mathematics/algebra/linear",
      "/en/try-out",
      "/en/try-out/indonesia",
      "/en/try-out/indonesia/snbt",
      "/id/articles",
      "/id/auth",
      "/id/kurikulum/merdeka",
      "/id/try-out",
    ]);
  });

  it("leaves out the search screen and every try-out track, set and section", () => {
    const paths = selectStaticPagePaths({
      locales: ["en"],
      sitemapPaths: [
        "/en/search",
        "/en/try-out/indonesia/snbt/2027",
        "/en/try-out/indonesia/snbt/2027/set-1",
        "/en/try-out/indonesia/snbt/2027/set-1/general-reasoning",
      ],
    });

    expect(paths).toEqual(["/en/articles", "/en/auth", "/en/try-out"]);
  });

  it("lists each path once, in a stable order", () => {
    const paths = selectStaticPagePaths({
      locales: ["en", "en"],
      sitemapPaths: ["/en/quran/2", "/en/quran/1", "/en/quran/1"],
    });

    expect(paths).toEqual([
      "/en/articles",
      "/en/auth",
      "/en/quran/1",
      "/en/quran/2",
      "/en/try-out",
    ]);
  });

  it.effect("reads the public paths of every sitemap page of the release", () =>
    Effect.gen(function* () {
      sitemap.descriptors.mockReturnValue(
        Effect.succeed([{ id: "base" }, { id: "quran_en" }])
      );
      sitemap.entries.mockImplementation(({ pageId }: { pageId: string }) =>
        Effect.succeed(
          pageId === "base"
            ? [{ url: "https://nakafa.com/en/pricing" }]
            : [{ url: "https://nakafa.com/en/quran/1" }]
        )
      );

      const paths = yield* readStaticPagePaths();

      expect(paths).toContain("/en/pricing");
      expect(paths).toContain("/en/quran/1");
      expect(paths).toContain("/de/articles");
      expect(paths).toContain("/id/try-out");
    })
  );
});
