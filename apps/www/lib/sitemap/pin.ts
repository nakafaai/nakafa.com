import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { Effect } from "effect";
import type { Locale } from "use-intl";
import { readActiveContentIdentity } from "@/lib/content/published/active";
import { PublishedProjectionError } from "@/lib/content/published/errors";
import { verifyContentReleasePin } from "@/lib/content/published/release";
import { SitemapPageNotFoundError } from "@/lib/sitemap/identity";

/**
 * Pins the active release for one sitemap page read.
 *
 * The pin comes from the stored pointer, like every key of the reads behind it.
 * `verify` asks Convex and fails once another release is active, so a pointer
 * that is out of date makes the read fail, and drop the pointer, instead of
 * putting a previous release behind the long origin-cache lifetime. Every read
 * that depends on a release ends with it. `missing` reports the page as
 * missing only while the pinned release is still the active one: a missing
 * page is cached behind the long origin-cache lifetime, so a page the landing
 * publication just added must fail the read instead of being cached as
 * missing.
 */
export const pinSitemapRelease = Effect.fn("www.sitemap.pin")(function* (
  pageId: string,
  locale: Locale
) {
  const identity = {
    appLocale: AppLocaleSchema.make(locale),
    publicPath: `sitemap/${pageId}.xml`,
  };
  const active = yield* readActiveContentIdentity();
  if (!active) {
    return yield* new PublishedProjectionError(identity);
  }
  const verify = verifyContentReleasePin(active.releaseId, identity);
  return {
    identity,
    missing: verify.pipe(
      Effect.andThen(new SitemapPageNotFoundError({ pageId }))
    ),
    verify,
  };
});
