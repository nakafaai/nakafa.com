import type {
  CatalogSectionSchema,
  CatalogTrackSchema,
} from "@nakafa/aksara-contracts/assessment/catalog";
import { KebabKeySchema } from "@nakafa/aksara-contracts/assessment/identity";
import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import { ActiveAppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { Effect, HashMap, Option, Result, Schema } from "effect";
import type { Locale } from "use-intl";
import {
  type ArtworkIdentity,
  resolveSocialArtwork,
  resolveStaticArtwork,
} from "@/lib/og/artwork";

/**
 * The reviewed artwork of each exam card, by its country and exam keys, never
 * its localized slugs. The Aufnahmeprüfung wears the owner's Deutschland
 * design, Germany's one exam, until it has its own.
 */
const EXAM_ARTWORK_BY_EXAM = HashMap.fromIterable<string, ArtworkIdentity>([
  ["germany/entrance-examination", "tryout/germany/index"],
  ["indonesia/snbt", "tryout/indonesia/snbt"],
  ["indonesia/tka", "tryout/indonesia/tka"],
]);

/**
 * The reviewed artwork of each try-out track that has one, by its country, exam
 * and track keys, never its localized slugs. Germany's Mathematics shares the
 * owner's Mathematics subject design until it has its own.
 */
const TRACK_ARTWORK_BY_TRACK = HashMap.fromIterable<string, ArtworkIdentity>([
  [
    "germany/entrance-examination/tu-darmstadt-mathematics",
    "subject/mathematics",
  ],
  ["indonesia/snbt/2027", "tryout/indonesia/2027"],
  [
    "indonesia/tka/advanced-mathematics",
    "tryout/indonesia/tka/advanced-mathematics",
  ],
  [
    "indonesia/tka/compulsory-mathematics",
    "tryout/indonesia/tka/compulsory-mathematics",
  ],
  ["indonesia/tka/english-language", "tryout/indonesia/tka/english-language"],
  [
    "indonesia/tka/indonesian-language",
    "tryout/indonesia/tka/indonesian-language",
  ],
]);

/** The reviewed artwork of each SNBT section that has one, by its stable key, never its localized slug. */
const SNBT_SECTION_ARTWORK_BY_SECTION_KEY = HashMap.fromIterable<
  (typeof CatalogSectionSchema.Type)["sectionKey"],
  ArtworkIdentity
>([
  ["general-reasoning", "tryout/indonesia/snbt/general-reasoning"],
  ["mathematical-reasoning", "tryout/indonesia/snbt/mathematical-reasoning"],
  ["quantitative-knowledge", "tryout/indonesia/snbt/quantitative-knowledge"],
]);

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
  cardImageSrc: Schema.optionalKey(Schema.String),
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
 * Resolves reviewed card and social artwork from one signed exam identity.
 * The direct Effect values preserve the static-prerender fast path at the
 * framework runner boundary.
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
  const artworkIdentity = getTryoutExamArtworkIdentity(
    identity.countryKey,
    identity.examKey
  );
  const socialImageSrc = resolveSocialArtwork({
    identity: artworkIdentity,
    locale: identity.appLocale,
    publicPath: identity.publicPath,
  });
  const cardImageSrc = artworkIdentity
    ? resolveStaticArtwork(artworkIdentity, identity.appLocale)
    : undefined;

  return Effect.succeed(
    TryoutExamArtworkSchema.make(
      cardImageSrc ? { cardImageSrc, socialImageSrc } : { socialImageSrc }
    )
  );
}

/** Resolves the reviewed artwork of one signed try-out track that has one, for its card and its social image. */
export function getTryoutTrackCatalogArtwork(
  locale: Locale,
  source: Pick<
    typeof CatalogTrackSchema.Type,
    "countryKey" | "examKey" | "trackKey"
  >
) {
  const identity = Option.getOrUndefined(
    HashMap.get(
      TRACK_ARTWORK_BY_TRACK,
      `${source.countryKey}/${source.examKey}/${source.trackKey}`
    )
  );

  return identity ? resolveStaticArtwork(identity, locale) : undefined;
}

/** Resolves the reviewed artwork of one signed try-out section, for its social image. */
export function getTryoutSectionArtwork(
  locale: Locale,
  source: Pick<
    typeof CatalogSectionSchema.Type,
    "countryKey" | "examKey" | "sectionKey"
  >
) {
  if (source.countryKey !== "indonesia" || source.examKey !== "snbt") {
    return;
  }
  const identity = Option.getOrUndefined(
    HashMap.get(SNBT_SECTION_ARTWORK_BY_SECTION_KEY, source.sectionKey)
  );
  return identity ? resolveStaticArtwork(identity, locale) : undefined;
}

function getTryoutExamArtworkIdentity(
  countryKey: string,
  examKey: string
): ArtworkIdentity | undefined {
  return Option.getOrUndefined(
    HashMap.get(EXAM_ARTWORK_BY_EXAM, `${countryKey}/${examKey}`)
  );
}
