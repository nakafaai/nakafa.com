import {
  ACTIVE_APP_LOCALE_CODES,
  ENGLISH_APP_LOCALE_CODE,
} from "@nakafa/aksara-contracts/locale";
import { Array as Arr, Option, Record as Rec, Tuple } from "effect";
import type { Locale } from "use-intl";
import { getOgUrl } from "@/lib/seo/social";

/** Which file of a design each locale's readers see: reader locale to file locale. */
type ArtworkReaders = Readonly<Record<string, Locale>>;

/** Every locale reads the design's file of its own locale. */
function own(...locales: readonly Locale[]): ArtworkReaders {
  return Rec.fromEntries(
    Arr.map(locales, (locale) => Tuple.make(locale, locale))
  );
}

/**
 * Every locale reads the one file of a design whose lettering no language
 * translates: an exam's name such as SNBT, a program's name such as Kurikulum
 * Merdeka, or an institution's name such as Niedersächsisches Studienkolleg.
 */
function shared(file: Locale): ArtworkReaders {
  return Rec.fromEntries(
    Arr.map(ACTIVE_APP_LOCALE_CODES, (locale) => Tuple.make(locale, file))
  );
}

/**
 * The designer's reviewed artwork by stable, language-neutral identity: for
 * each locale, the file whose lettering reads that locale's own words. A
 * locale reads another locale's file only where the words are the same, such
 * as Malay `Kimia` on the Indonesian file. A locale missing here has no
 * lettering of its own yet: its card draws a tile, and only its social image
 * falls back to the English file.
 */
export const artworkSources = {
  "app/ask-nina": { ...own("en", "id", "de"), ms: "id" },
  "app/landing": own("en", "id", "de"),
  "app/pricing": { ...own("en", "id", "de"), ms: "id" },
  "app/school": shared("en"),
  "curriculum/cambridge-international": shared("en"),
  "curriculum/index": { ...own("en", "id", "de"), ms: "id" },
  "curriculum/kssm": shared("en"),
  "curriculum/merdeka": shared("id"),
  "curriculum/singapore-moe": shared("en"),
  "curriculum/united-states": shared("en"),
  "grade/class-9": { ...own("en", "id", "de"), ms: "id" },
  "grade/class-10": { ...own("en", "id", "de"), ms: "id" },
  "grade/class-11": { ...own("en", "id", "de"), ms: "id" },
  "grade/class-12": { ...own("en", "id", "de"), ms: "id" },
  "grade/form-4": { ...own("en", "id"), de: "en", ms: "id" },
  "grade/form-5": { ...own("en", "id"), de: "en", ms: "id" },
  "grade/hannover": shared("de"),
  "grade/high-school": { ...own("en", "id"), de: "en", ms: "en" },
  "grade/sachsen": shared("de"),
  "grade/secondary": { ...own("en", "de"), id: "en" },
  "grade/tu-darmstadt": shared("de"),
  "grade/upper-secondary": { ...own("en", "de"), id: "en" },
  "quran/index": shared("en"),
  "subject/additional-mathematics": { ...own("en", "de"), id: "en" },
  "subject/biology": { ...own("en", "id", "de"), ms: "id" },
  "subject/chemistry": { ...own("en", "id", "de"), ms: "id" },
  "subject/mathematics": own("en", "id", "de", "ms"),
  "subject/physics": own("en", "id", "de", "ms"),
  "subject/science": { ...own("en", "id", "de"), ms: "id" },
  "tryout/germany/entrance-examination": shared("en"),
  "tryout/germany/entrance-examination/tu-darmstadt-mathematics": own("de"),
  "tryout/germany/index": shared("en"),
  "tryout/indonesia/2027": shared("en"),
  "tryout/indonesia/index": shared("en"),
  "tryout/indonesia/snbt": shared("en"),
  "tryout/indonesia/snbt/general-reasoning": own("en", "id", "de"),
  "tryout/indonesia/snbt/mathematical-reasoning": own("en", "id", "de"),
  "tryout/indonesia/snbt/quantitative-knowledge": {
    ...own("en", "id", "de"),
    ms: "id",
  },
  "tryout/indonesia/tka": shared("en"),
  "tryout/indonesia/tka/advanced-mathematics": own("en", "id", "de"),
  "tryout/indonesia/tka/compulsory-mathematics": own("en", "id", "de"),
  "tryout/indonesia/tka/english-language": own("en", "id", "de"),
  "tryout/indonesia/tka/indonesian-language": {
    ...own("en", "id", "de"),
    ms: "id",
  },
  "tryout/malaysia/spm/biology": { ...own("en", "id", "de"), ms: "id" },
  "tryout/malaysia/spm/chemistry": { ...own("en", "id", "de"), ms: "id" },
  "tryout/malaysia/spm/physics": own("en", "id", "de"),
} as const satisfies Readonly<Record<string, ArtworkReaders>>;

export type ArtworkIdentity = keyof typeof artworkSources;

const artworkReaders: Readonly<Record<ArtworkIdentity, ArtworkReaders>> =
  artworkSources;

/**
 * The file a card of the identity draws in the locale: only a file whose
 * lettering reads that locale's words, or nothing, so the card draws its tile.
 */
export function resolveCardArtwork(
  identity: ArtworkIdentity | undefined,
  locale: Locale
) {
  if (!identity) {
    return;
  }

  return Option.getOrUndefined(
    Option.map(Rec.get(artworkReaders[identity], locale), (file) =>
      getStaticArtworkPath(identity, file)
    )
  );
}

/**
 * The social image of the identity in the locale: the card's file, or the
 * English readers' file for a locale whose lettering is not drawn yet.
 */
export function resolveStaticArtwork(
  identity: ArtworkIdentity | undefined,
  locale: Locale
) {
  return (
    resolveCardArtwork(identity, locale) ??
    resolveCardArtwork(identity, ENGLISH_APP_LOCALE_CODE)
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
