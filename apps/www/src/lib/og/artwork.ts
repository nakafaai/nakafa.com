import {
  ACTIVE_APP_LOCALE_CODES,
  ENGLISH_APP_LOCALE_CODE,
} from "@nakafa/aksara-contracts/locale";
import { Array as Arr, Option, Record as Rec } from "effect";
import type { Locale } from "use-intl";
import { getOgUrl } from "@/lib/seo/social";

const ALL_ARTWORK_LOCALES = ACTIVE_APP_LOCALE_CODES;
const ENGLISH_ARTWORK = [ENGLISH_APP_LOCALE_CODE] as const;
/**
 * A design whose Indonesian lettering is not Malaysian Malay, such as
 * `Matematika` for `Matematik`, until the Malay lettering is drawn. A design
 * whose lettering reads the same in both, such as `tanya Nina`, has its Malay
 * file.
 */
const WITHOUT_MALAY_ARTWORK = ["en", "id", "de"] as const;

/**
 * Reviewed public artwork grouped by stable, language-neutral identity, each with
 * the locales it has a file for. A design whose words read the same in every
 * language, such as the School's or the Quran's, has one English file, which
 * every locale falls back to. A design whose words belong to one language, such
 * as the landing's "belajar sampai paham.", has a file for that language alone,
 * and every other locale keeps its generated image.
 */
export const artworkSources = {
  "app/ask-nina": ALL_ARTWORK_LOCALES,
  "app/landing": ["id"],
  "app/pricing": ALL_ARTWORK_LOCALES,
  "app/school": ENGLISH_ARTWORK,
  "curriculum/cambridge-international": ENGLISH_ARTWORK,
  "curriculum/index": ALL_ARTWORK_LOCALES,
  "curriculum/kssm": ENGLISH_ARTWORK,
  "curriculum/merdeka": ALL_ARTWORK_LOCALES,
  "curriculum/singapore-moe": ENGLISH_ARTWORK,
  "curriculum/united-states": ENGLISH_ARTWORK,
  "grade/class-9": ALL_ARTWORK_LOCALES,
  "grade/class-10": ALL_ARTWORK_LOCALES,
  "grade/class-11": ALL_ARTWORK_LOCALES,
  "grade/class-12": ALL_ARTWORK_LOCALES,
  "grade/form-4": ["en", "id"],
  "grade/form-5": ["en", "id"],
  "grade/high-school": ["en", "id"],
  "grade/secondary": ["en", "de"],
  "grade/upper-secondary": ["en", "de"],
  "quran/index": ENGLISH_ARTWORK,
  "subject/biology": ALL_ARTWORK_LOCALES,
  "subject/chemistry": ALL_ARTWORK_LOCALES,
  "subject/mathematics": WITHOUT_MALAY_ARTWORK,
  "subject/physics": WITHOUT_MALAY_ARTWORK,
  "subject/science": ALL_ARTWORK_LOCALES,
  "subject/secondary-additional-mathematics": ["en", "de"],
  "tryout/germany/index": ENGLISH_ARTWORK,
  "tryout/indonesia/2027": ENGLISH_ARTWORK,
  "tryout/indonesia/index": ENGLISH_ARTWORK,
  "tryout/indonesia/snbt": ENGLISH_ARTWORK,
  "tryout/indonesia/snbt/general-reasoning": WITHOUT_MALAY_ARTWORK,
  "tryout/indonesia/snbt/mathematical-reasoning": WITHOUT_MALAY_ARTWORK,
  "tryout/indonesia/snbt/quantitative-knowledge": ALL_ARTWORK_LOCALES,
  "tryout/indonesia/tka": ENGLISH_ARTWORK,
  "tryout/indonesia/tka/advanced-mathematics": WITHOUT_MALAY_ARTWORK,
  "tryout/indonesia/tka/compulsory-mathematics": WITHOUT_MALAY_ARTWORK,
  "tryout/indonesia/tka/english-language": WITHOUT_MALAY_ARTWORK,
  "tryout/indonesia/tka/indonesian-language": ALL_ARTWORK_LOCALES,
} as const satisfies Readonly<Record<string, readonly [Locale, ...Locale[]]>>;

export type ArtworkIdentity = keyof typeof artworkSources;

/** The inventory read by any name, so a name that a route makes up finds its artwork or none. */
const artworkInventory: Readonly<
  Record<string, readonly [Locale, ...Locale[]]>
> = artworkSources;

/**
 * The file of one identity in the locale, or in English when the locale has none, and none for a design of another
 * language alone.
 */
function pickArtworkPath(
  identity: string,
  locales: readonly Locale[],
  locale: Locale
) {
  return Option.map(
    Option.orElse(
      Arr.findFirst(locales, (candidate) => candidate === locale),
      () =>
        Arr.findFirst(
          locales,
          (candidate) => candidate === ENGLISH_APP_LOCALE_CODE
        )
    ),
    (artworkLocale) => getStaticArtworkPath(identity, artworkLocale)
  );
}

/** Resolves exact locale artwork, then the reviewed English default, and none for a design of another language. */
export function resolveStaticArtwork(
  identity: ArtworkIdentity | undefined,
  locale: Locale
) {
  if (!identity) {
    return;
  }

  return Option.getOrUndefined(
    pickArtworkPath(identity, artworkSources[identity], locale)
  );
}

/**
 * Resolves the artwork that a name made from what a page is, such as
 * `subject/chemistry`, finds in the inventory, or nothing when no design names
 * it yet.
 */
export function resolveNamedArtwork(identity: string, locale: Locale) {
  return Option.flatMap(Rec.get(artworkInventory, identity), (locales) =>
    pickArtworkPath(identity, locales, locale)
  );
}

/** Resolves static artwork or the localized generated social fallback. */
export function resolveSocialArtwork({
  identity,
  locale,
  publicPath,
}: {
  readonly identity: ArtworkIdentity | undefined;
  readonly locale: Locale;
  readonly publicPath: string;
}) {
  return resolveStaticArtwork(identity, locale) ?? getOgUrl(locale, publicPath);
}

/** A file of the static inventory, as `getStaticArtworkPath` names it. */
const STATIC_ARTWORK_FILE = /^(?<file>\/open-graph\/.+)\.png$/u;

/**
 * The file a catalog card draws for its artwork. A social card needs the 1200 pixel
 * PNG, but a card shows it 384 pixels wide, and it is the largest thing on a
 * catalog page, so a card draws the 768 pixel WebP beside it, a quarter of the
 * weight. A generated image has no such file and stays as it is.
 */
export function toCardArtwork(source: string) {
  return source.replace(STATIC_ARTWORK_FILE, "$<file>.webp");
}

function getStaticArtworkPath(identity: string, locale: string) {
  const separator = identity.lastIndexOf("/");
  const directory = identity.slice(0, separator);
  const key = identity.slice(separator + 1);

  return `/open-graph/${directory}/${locale}-${key}.png` as const;
}
