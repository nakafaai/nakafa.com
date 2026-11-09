import type {
  CatalogSectionSchema,
  CatalogTrackSchema,
} from "@nakafa/aksara-contracts/assessment/catalog";
import { KebabKeySchema } from "@nakafa/aksara-contracts/assessment/identity";
import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import { ActiveAppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import {
  Array as Arr,
  Effect,
  HashMap,
  Option,
  Record as Rec,
  Result,
  Schema,
  Tuple,
} from "effect";
import type { Locale } from "use-intl";
import {
  type ArtworkIdentity,
  resolveSocialArtwork,
  resolveStaticArtwork,
} from "@/lib/og/artwork";

/**
 * The image of one entity's card, such as SNBT's or a TKA subject's, which
 * that entity's own pages may share as their social image. Only this type
 * reaches a try-out card.
 */
export const CardArtworkSchema = Schema.String.pipe(
  Schema.brand("TryoutCardArtwork")
);

/**
 * The social image of one page alone, such as a country's: it stands in that
 * page's metadata and on no card.
 */
const PageArtworkSchema = Schema.String.pipe(Schema.brand("TryoutPageArtwork"));

/** What one reviewed design was drawn for: one entity, or one page. */
const ArtworkRoleSchema = Schema.Literals(["entity", "page"]);

/** One reviewed design: its installed identity, its role, and the owner's source file for each locale. */
const TryoutArtworkSchema = Schema.Struct({
  drawn: Schema.Record(Schema.String, Schema.Int),
  identity: Schema.String,
  role: ArtworkRoleSchema,
});

/**
 * The owner's try-out designs, each recorded once with the one entity or page
 * it was drawn for, keyed by the stable keys of that entity, never its
 * localized slugs. `drawn` names the file of each locale in the owner's
 * source folder (`opengraph-nakafa/tryout/<number>.webp`). A country's design
 * is that country page's social image alone. An entity that has no design of
 * its own, such as the Aufnahmeprüfung or its Mathematics, shows no image.
 */
const TRYOUT_ARTWORK = {
  "country/germany": {
    drawn: { en: 102 },
    identity: "tryout/germany/index",
    role: "page",
  },
  "country/indonesia": {
    drawn: { en: 101 },
    identity: "tryout/indonesia/index",
    role: "page",
  },
  "exam/indonesia/snbt": {
    drawn: { en: 88 },
    identity: "tryout/indonesia/snbt",
    role: "entity",
  },
  "exam/indonesia/tka": {
    drawn: { en: 89 },
    identity: "tryout/indonesia/tka",
    role: "entity",
  },
  "section/indonesia/snbt/general-reasoning": {
    drawn: { de: 39, en: 38, id: 37 },
    identity: "tryout/indonesia/snbt/general-reasoning",
    role: "page",
  },
  "section/indonesia/snbt/mathematical-reasoning": {
    drawn: { de: 48, en: 47, id: 46 },
    identity: "tryout/indonesia/snbt/mathematical-reasoning",
    role: "page",
  },
  "section/indonesia/snbt/quantitative-knowledge": {
    drawn: { de: 51, en: 50, id: 49 },
    identity: "tryout/indonesia/snbt/quantitative-knowledge",
    role: "page",
  },
  "track/indonesia/snbt/2027": {
    drawn: { en: 91 },
    identity: "tryout/indonesia/2027",
    role: "entity",
  },
  "track/indonesia/tka/advanced-mathematics": {
    drawn: { de: 114, en: 113, id: 112 },
    identity: "tryout/indonesia/tka/advanced-mathematics",
    role: "entity",
  },
  "track/indonesia/tka/compulsory-mathematics": {
    drawn: { de: 111, en: 110, id: 109 },
    identity: "tryout/indonesia/tka/compulsory-mathematics",
    role: "entity",
  },
  "track/indonesia/tka/english-language": {
    drawn: { de: 105, en: 104, id: 103 },
    identity: "tryout/indonesia/tka/english-language",
    role: "entity",
  },
  "track/indonesia/tka/indonesian-language": {
    drawn: { de: 108, en: 107, id: 106 },
    identity: "tryout/indonesia/tka/indonesian-language",
    role: "entity",
  },
} as const satisfies Record<string, typeof TryoutArtworkSchema.Type>;

/**
 * The identity of each design of one role, by the key of what it was drawn for.
 * Each identity must be one the artwork manifest installs.
 */
function identitiesOf(role: typeof ArtworkRoleSchema.Type) {
  return HashMap.fromIterable<string, ArtworkIdentity>(
    Arr.filterMap(Rec.toEntries(TRYOUT_ARTWORK), ([key, artwork]) =>
      artwork.role === role
        ? Result.succeed(Tuple.make(key, artwork.identity))
        : Result.failVoid
    )
  );
}

const ENTITY_ARTWORK = identitiesOf("entity");
const PAGE_ARTWORK = identitiesOf("page");

/** The card image of one entity, by its kind and keys, or none when it has no design of its own. */
function cardArtworkOf(locale: Locale, key: string) {
  return Option.getOrUndefined(
    Option.map(
      Option.flatMap(HashMap.get(ENTITY_ARTWORK, key), (identity) =>
        Option.fromNullishOr(resolveStaticArtwork(identity, locale))
      ),
      (src) => CardArtworkSchema.make(src)
    )
  );
}

/** The social image of one page, by its kind and keys, or none when the page has no design of its own. */
function pageArtworkOf(locale: Locale, key: string) {
  return Option.getOrUndefined(
    Option.map(
      Option.flatMap(HashMap.get(PAGE_ARTWORK, key), (identity) =>
        Option.fromNullishOr(resolveStaticArtwork(identity, locale))
      ),
      (src) => PageArtworkSchema.make(src)
    )
  );
}

/** The identity of an entity's design, for the social image of that entity's own page. */
function entityIdentityOf(key: string) {
  return Option.getOrUndefined(HashMap.get(ENTITY_ARTWORK, key));
}

const TryoutExamArtworkIdentitySchema = Schema.Struct({
  countryKey: KebabKeySchema,
  examKey: KebabKeySchema,
  appLocale: ActiveAppLocaleSchema,
  publicPath: PublicPathSchema.pipe(
    Schema.check(
      Schema.makeFilter(
        (publicPath) => {
          const segments = publicPath.split("/");
          return (
            (segments.length === 3 || segments.length === 4) &&
            segments[0] === "try-out"
          );
        },
        {
          message: "Expected one localized try-out exam or group public path.",
        }
      )
    )
  ),
});

const TryoutExamArtworkSchema = Schema.Struct({
  cardImageSrc: Schema.optionalKey(CardArtworkSchema),
  socialImageSrc: Schema.String,
});

export class InvalidTryoutExamArtworkIdentityError extends Schema.TaggedError<
  InvalidTryoutExamArtworkIdentityError,
  { readonly brand: unique symbol }
>()("InvalidTryoutExamArtworkIdentityError", { message: Schema.String }) {}

const decodeTryoutExamArtworkIdentity = Schema.decodeUnknownResult(
  TryoutExamArtworkIdentitySchema
);

/**
 * Resolves an exam's card image and the social image of its pages from one
 * signed exam identity: the exam's own design when it has one, and the page's
 * generated image otherwise. The direct Effect values preserve the
 * static-prerender fast path at the framework runner boundary.
 */
export function resolveTryoutExamArtwork(
  input: unknown
): Effect.Effect<
  typeof TryoutExamArtworkSchema.Type,
  InvalidTryoutExamArtworkIdentityError
> {
  const decodedIdentity = decodeTryoutExamArtworkIdentity(input);
  if (Result.isFailure(decodedIdentity)) {
    return Effect.fail(
      new InvalidTryoutExamArtworkIdentityError({
        message: "Invalid try-out exam artwork identity",
      })
    );
  }

  const identity = decodedIdentity.success;
  const key = `exam/${identity.countryKey}/${identity.examKey}`;
  const socialImageSrc = resolveSocialArtwork({
    identity: entityIdentityOf(key),
    locale: identity.appLocale,
    publicPath: identity.publicPath,
  });
  const cardImageSrc = cardArtworkOf(identity.appLocale, key);

  return Effect.succeed(
    TryoutExamArtworkSchema.make(
      cardImageSrc ? { cardImageSrc, socialImageSrc } : { socialImageSrc }
    )
  );
}

/** Resolves the card image of one signed try-out track that has a design of its own, which its page shares too. */
export function getTryoutTrackCatalogArtwork(
  locale: Locale,
  source: Pick<
    typeof CatalogTrackSchema.Type,
    "countryKey" | "examKey" | "trackKey"
  >
) {
  return cardArtworkOf(
    locale,
    `track/${source.countryKey}/${source.examKey}/${source.trackKey}`
  );
}

/** Resolves the social image of one signed try-out section page that has a design of its own. */
export function getTryoutSectionArtwork(
  locale: Locale,
  source: Pick<
    typeof CatalogSectionSchema.Type,
    "countryKey" | "examKey" | "sectionKey"
  >
) {
  return pageArtworkOf(
    locale,
    `section/${source.countryKey}/${source.examKey}/${source.sectionKey}`
  );
}

/** Resolves the social image of one country page, the country's own design, never a card's. */
export function getTryoutCountryPageArtwork(
  locale: Locale,
  countryKey: string
) {
  return pageArtworkOf(locale, `country/${countryKey}`);
}
