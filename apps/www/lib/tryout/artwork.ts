import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import { ActiveAppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { TryoutKeySchema } from "@nakafa/aksara-contracts/tryout/key";
import { Effect, Result, Schema } from "effect";
import { constant } from "effect/Function";
import { getOgUrl } from "@/lib/utils/metadata";

const reviewedTryoutExamArtworkSources = [
  {
    countryKey: "indonesia",
    examKey: "snbt",
    appLocale: "en",
  },
  {
    countryKey: "indonesia",
    examKey: "tka",
    appLocale: "en",
  },
  {
    countryKey: "indonesia",
    examKey: "snbt",
    appLocale: "id",
  },
  {
    countryKey: "indonesia",
    examKey: "tka",
    appLocale: "id",
  },
];
const ReviewedTryoutExamArtworkSchema = Schema.Struct({
  countryKey: TryoutKeySchema,
  examKey: TryoutKeySchema,
  appLocale: ActiveAppLocaleSchema,
});
const ReviewedTryoutExamArtworkRegistrySchema = Schema.Array(
  ReviewedTryoutExamArtworkSchema
).pipe(
  Schema.check(
    Schema.makeFilter(
      (images) =>
        new Set(images.map(getTryoutExamArtworkIdentity)).size === images.length
    )
  )
);
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
  {
    message: Schema.String,
  }
) {}
class InvalidReviewedTryoutExamArtworkRegistryError extends Schema.TaggedError<InvalidReviewedTryoutExamArtworkRegistryError>()(
  "InvalidReviewedTryoutExamArtworkRegistryError",
  {
    message: Schema.String,
  }
) {}
const decodeTryoutExamArtworkIdentity = Schema.decodeUnknownResult(
  TryoutExamArtworkIdentitySchema
);
const invalidReviewedTryoutExamArtworkRegistryError =
  new InvalidReviewedTryoutExamArtworkRegistryError({
    message: "Invalid reviewed try-out exam artwork registry",
  });
const reviewedTryoutExamArtwork = Result.mapError(
  Schema.decodeUnknownResult(ReviewedTryoutExamArtworkRegistrySchema)(
    reviewedTryoutExamArtworkSources
  ),
  constant(invalidReviewedTryoutExamArtworkRegistryError)
);
const reviewedTryoutExamArtworkByIdentity = Result.map(
  reviewedTryoutExamArtwork,
  (images) =>
    new Map(
      images.map((image) => [
        getTryoutExamArtworkIdentity(image),
        getReviewedTryoutExamArtworkPath(image),
      ])
    )
);
/**
 * Resolves reviewed card artwork and localized social artwork for one exam.
 * Static prerender safety depends on this resolver returning direct Success or
 * Failure values and callers using Effect.runSync, whose fast path avoids
 * starting a fiber and reading time.
 * https://nextjs.org/docs/messages/next-prerender-current-time
 */
export function resolveTryoutExamArtwork(
  input: unknown
): Effect.Effect<
  TryoutExamArtwork,
  | InvalidReviewedTryoutExamArtworkRegistryError
  | InvalidTryoutExamArtworkIdentityError
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
  /* istanbul ignore next -- invalid authored registry fails every real resolver fixture */
  if (Result.isFailure(reviewedTryoutExamArtworkByIdentity)) {
    return Effect.fail(reviewedTryoutExamArtworkByIdentity.failure);
  }
  const reviewedImagePath = reviewedTryoutExamArtworkByIdentity.success.get(
    getTryoutExamArtworkIdentity(identity)
  );
  if (!reviewedImagePath) {
    return Effect.succeed(
      TryoutExamArtworkSchema.make({
        socialImageSrc: getOgUrl(identity.appLocale, identity.publicPath),
      })
    );
  }
  return Effect.succeed(
    TryoutExamArtworkSchema.make({
      cardImageSrc: reviewedImagePath,
      socialImageSrc: reviewedImagePath,
    })
  );
}
function getReviewedTryoutExamArtworkPath(image: {
  readonly countryKey: string;
  readonly examKey: string;
  readonly appLocale: string;
}) {
  return `/open-graph/tryout/${image.countryKey}/${image.appLocale}-${image.examKey}.png`;
}
function getTryoutExamArtworkIdentity(identity: {
  readonly countryKey: string;
  readonly examKey: string;
  readonly appLocale: string;
}) {
  return `${identity.countryKey}:${identity.appLocale}:${identity.examKey}`;
}
