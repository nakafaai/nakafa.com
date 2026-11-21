import { SITE_ORIGIN } from "@repo/seo/origin";
import { Array as Arr, Effect, Schema } from "effect";
import { readSitemapPageDescriptors } from "@/lib/sitemap/catalog";
import { getSitemapEntries } from "@/lib/sitemap/entries";
import { buildSitemapIndexXml, buildSitemapUrlSetXml } from "@/lib/sitemap/xml";
import { isUnlistedPath } from "@/lib/static/pages";

/** One text file of the build, with its path under the client output. */
const SitemapFile = Schema.Struct({ path: Schema.String, text: Schema.String });
type SitemapFile = typeof SitemapFile.Type;

/**
 * Renders the sitemap index and every bounded sitemap page of the active release,
 * at the addresses that the sitemap index names. A page that its head keeps out
 * of search indexes is not listed (`isUnlistedPath`), and a sitemap page left
 * with no listed address, such as a locale's Quran page, is neither written nor
 * named by the index.
 */
export const readSitemapFiles = Effect.fn("www.sitemap.files")(function* () {
  const descriptors = yield* readSitemapPageDescriptors();
  const listed = yield* Effect.forEach(
    descriptors,
    (descriptor) =>
      Effect.map(getSitemapEntries({ pageId: descriptor.id }), (entries) => ({
        entries: Arr.filter(
          entries,
          ({ url }) => !isUnlistedPath(new URL(url).pathname)
        ),
        id: descriptor.id,
      })),
    { concurrency: 8 }
  );
  const pages = Arr.filter(listed, ({ entries }) => entries.length > 0);
  const index: SitemapFile = {
    path: "sitemap.xml",
    text: buildSitemapIndexXml(
      Arr.map(pages, ({ id }) => `${SITE_ORIGIN}/sitemap/${id}.xml`)
    ),
  };
  return [
    index,
    ...Arr.map(
      pages,
      ({ entries, id }): SitemapFile => ({
        path: `sitemap/${id}.xml`,
        text: buildSitemapUrlSetXml(entries),
      })
    ),
  ];
});
