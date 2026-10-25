import { SITE_ORIGIN } from "@repo/seo/origin";
import { Array as Arr, Effect, Schema } from "effect";
import { readSitemapPageDescriptors } from "@/lib/sitemap/catalog";
import { getSitemapEntries } from "@/lib/sitemap/entries";
import { buildSitemapIndexXml, buildSitemapUrlSetXml } from "@/lib/sitemap/xml";

/** One text file of the build, with its path under the client output. */
const SitemapFile = Schema.Struct({ path: Schema.String, text: Schema.String });
type SitemapFile = typeof SitemapFile.Type;

/**
 * Renders the sitemap index and every bounded sitemap page of the active release,
 * at the addresses that the sitemap index names.
 */
export const readSitemapFiles = Effect.fn("www.sitemap.files")(function* () {
  const descriptors = yield* readSitemapPageDescriptors();
  const pages = yield* Effect.forEach(
    descriptors,
    (descriptor) =>
      Effect.map(
        getSitemapEntries({ pageId: descriptor.id }),
        (entries): SitemapFile => ({
          path: `sitemap/${descriptor.id}.xml`,
          text: buildSitemapUrlSetXml(entries),
        })
      ),
    { concurrency: 8 }
  );
  const index: SitemapFile = {
    path: "sitemap.xml",
    text: buildSitemapIndexXml(
      Arr.map(descriptors, ({ id }) => `${SITE_ORIGIN}/sitemap/${id}.xml`)
    ),
  };
  return [index, ...pages];
});
