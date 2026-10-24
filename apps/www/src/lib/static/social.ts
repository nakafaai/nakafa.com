import { ActiveAppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import { LOCALES } from "@repo/internationalization/src/locale";
import { cleanSlug } from "@repo/utilities/slug";
import { Array as Arr, Effect, Schema } from "effect";
import { readSitemapPageDescriptors } from "@/lib/sitemap/catalog";
import { getSitemapEntryLocales } from "@/lib/sitemap/entries";
import { readSitemapRoutePage } from "@/lib/sitemap/routes";

/**
 * The section images that no sitemap route names under the same path: the articles
 * index, and the curriculum index, whose route is `curricula` while its image is
 * written under `curriculum`.
 */
const SECTION_SLUGS = ["articles", "curriculum"] as const;

/** The home image, whose route slug is empty. */
const HOME_SLUG = "";

/** One social image of the build: the locale and the slug that `/{locale}/og/{slug}/image.png` names. */
const SocialImageSource = Schema.Struct({
  locale: ActiveAppLocaleCodeSchema,
  slug: Schema.String,
});
export type SocialImageSource = typeof SocialImageSource.Type;

/** The routes of one sitemap page, with the locales that its entries are written in. */
const SocialImagePage = Schema.Struct({
  locales: Schema.Array(ActiveAppLocaleCodeSchema),
  paths: Schema.Array(Schema.String),
});
type SocialImagePage = typeof SocialImagePage.Type;

/**
 * Lists the social images of the build: every sitemap route in each locale of its
 * page, the articles index and the home page, once each. A slug is a route path
 * without its slashes, the way `getOgUrl` writes it into the image address.
 */
export function listSocialImageSources(
  pages: readonly SocialImagePage[]
): SocialImageSource[] {
  const sections = Arr.flatMap(LOCALES, (locale) => [
    { locale, slug: HOME_SLUG },
    ...Arr.map(SECTION_SLUGS, (slug) => ({ locale, slug })),
  ]);
  const routes = Arr.flatMap(pages, (page) =>
    Arr.flatMap(page.locales, (locale) =>
      Arr.map(page.paths, (path) => ({ locale, slug: cleanSlug(path) }))
    )
  );
  return Arr.dedupeWith(
    [...sections, ...routes],
    (left, right) => left.locale === right.locale && left.slug === right.slug
  );
}

/** Reads the routes of every sitemap page of the active release and lists their social images. */
export const readSocialImageSources = Effect.fn("www.static.social.sources")(
  function* () {
    const descriptors = yield* readSitemapPageDescriptors();
    const pages = yield* Effect.forEach(
      descriptors,
      (descriptor) =>
        Effect.map(readSitemapRoutePage(descriptor.id), ({ routes }) => ({
          locales: getSitemapEntryLocales(descriptor.id),
          paths: Arr.map(routes, (route) => route.path),
        })),
      { concurrency: 8 }
    );
    return listSocialImageSources(pages);
  }
);
