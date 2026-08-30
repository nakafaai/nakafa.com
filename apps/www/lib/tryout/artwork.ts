import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import { ActiveAppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import type { TryoutTrack } from "@nakafa/aksara-contracts/tryout/catalog";
import { TryoutKeySchema } from "@nakafa/aksara-contracts/tryout/key";
import { Effect, Result, Schema } from "effect";
import type { Locale } from "next-intl";
import {
  type ArtworkIdentity,
  resolveSocialArtwork,
  resolveStaticArtwork,
} from "@/lib/og/artwork";

const TRYOUT_SUBJECT_ARTWORK_BY_TRACK_KEY = new Map<
  TryoutTrack["trackKey"],
  ArtworkIdentity
>([["mathematics", "subject/mathematics"]]);

const TryoutExamArtworkIdentitySchema = Schema.Struct({
  countryKey: TryoutKeySchema,
  examKey: TryoutKeySchema,
  appLocale: ActiveAppLocaleSchema,
  publicPath: PublicPathSchema.pipe(
    Schema.check(
      Schema.makeFilter(
        (publicPath) => {
          const segments = publicPath.split("/");
          return segments.length === 3 && segments[0] === "try-out";
        },
        { message: "Expected one localized try-out exam public path." }
      )
    )
  ),
});

export const TryoutExamArtworkSchema = Schema.Struct({
  cardImageSrc: Schema.optionalKey(Schema.String),
  socialImageSrc: Schema.String,
});
export type TryoutExamArtwork = Schema.Schema.Type<
  typeof TryoutExamArtworkSchema
>;

export class InvalidTryoutExamArtworkIdentityError extends Schema.TaggedError<InvalidTryoutExamArtworkIdentityError>()(
  "InvalidTryoutExamArtworkIdentityError",
  { message: Schema.String }
) {}

const decodeTryoutExamArtworkIdentity = Schema.decodeUnknownResult(
  TryoutExamArtworkIdentitySchema
);

/**
 * Resolves reviewed card and social artwork from one signed exam identity.
 * The direct Effect values preserve the static-prerender fast path at the
 * framework runner boundary.
 * https://nextjs.org/docs/messages/next-prerender-current-time
 */
export function resolveTryoutExamArtwork(input: unknown) {
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

/** Resolves subject or year artwork for one signed try-out track. */
export function getTryoutTrackCatalogArtwork(
  locale: Locale,
  source: Pick<TryoutTrack, "countryKey" | "examKey" | "trackKey" | "trackKind">
) {
  let identity: ArtworkIdentity | undefined;
  if (
    source.countryKey === "indonesia" &&
    source.examKey === "snbt" &&
    source.trackKind === "year" &&
    source.trackKey === "2027"
  ) {
    identity = "tryout/indonesia/2027";
  } else if (
    source.countryKey === "indonesia" &&
    source.examKey === "tka" &&
    source.trackKind === "subject"
  ) {
    identity = TRYOUT_SUBJECT_ARTWORK_BY_TRACK_KEY.get(source.trackKey);
  }

  return identity ? resolveStaticArtwork(identity, locale) : undefined;
}

function getTryoutExamArtworkIdentity(
  countryKey: string,
  examKey: string
): ArtworkIdentity | undefined {
  if (countryKey !== "indonesia") {
    return;
  }
  if (examKey === "snbt") {
    return "tryout/indonesia/snbt";
  }
  if (examKey === "tka") {
    return "tryout/indonesia/tka";
  }
}
