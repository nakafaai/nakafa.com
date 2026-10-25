import { ActiveAppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import type { LOCALES } from "@repo/internationalization/src/locale";
import { Array as Arr, Schema } from "effect";
import { OG_COLLECTIONS } from "@/lib/seo/social";

/** The home image, whose address has no collection segment. */
const HOME_SLUG = "";

/** One social image of the build: the locale and the collection that `/{locale}/og/{slug}/image.png` names. */
const SocialImageSource = Schema.Struct({
  locale: ActiveAppLocaleCodeSchema,
  slug: Schema.String,
});
export type SocialImageSource = typeof SocialImageSource.Type;

/**
 * Lists the social images of the build: one per section and locale, plus the home
 * image. A page shares the image of its section, so the build writes no image
 * per page.
 */
export function listSocialImageSources(
  locales: readonly (typeof LOCALES)[number][]
): SocialImageSource[] {
  return Arr.flatMap(locales, (locale) =>
    Arr.map([HOME_SLUG, ...OG_COLLECTIONS], (slug) => ({ locale, slug }))
  );
}
