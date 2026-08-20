import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import { ActiveAppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { TryoutKeySchema } from "@nakafa/aksara-contracts/tryout/key";
import { Effect, Result, Schema } from "effect";
import { constant } from "effect/Function";
import { getOgUrl } from "@/lib/utils/metadata";

const reviewedTryoutSocialImageSources = [
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
const ReviewedTryoutSocialImageSchema = Schema.Struct({
  countryKey: TryoutKeySchema,
  examKey: TryoutKeySchema,
  appLocale: ActiveAppLocaleSchema,
});
const ReviewedTryoutSocialImageRegistrySchema = Schema.Array(
  ReviewedTryoutSocialImageSchema
).pipe(
  Schema.check(
    Schema.makeFilter(
      (images) =>
        new Set(images.map(getTryoutSocialImageIdentity)).size === images.length
    )
  )
);
const TryoutExamSocialImageIdentitySchema = Schema.Struct({
  countryKey: TryoutKeySchema,
  examKey: TryoutKeySchema,
  appLocale: ActiveAppLocaleSchema,
  publicPath: PublicPathSchema,
});
export class InvalidTryoutSocialImageIdentityError extends Schema.TaggedError<InvalidTryoutSocialImageIdentityError>()(
  "InvalidTryoutSocialImageIdentityError",
  {
    message: Schema.String,
  }
) {}
class InvalidReviewedTryoutSocialImageRegistryError extends Schema.TaggedError<InvalidReviewedTryoutSocialImageRegistryError>()(
  "InvalidReviewedTryoutSocialImageRegistryError",
  {
    message: Schema.String,
  }
) {}
export class TryoutSocialImageIdentityMismatchError extends Schema.TaggedError<TryoutSocialImageIdentityMismatchError>()(
  "TryoutSocialImageIdentityMismatchError",
  {
    actualPublicPath: Schema.String,
    expectedPublicPath: Schema.String,
    message: Schema.String,
  }
) {}
const decodeTryoutExamSocialImageIdentity = Schema.decodeUnknownResult(
  TryoutExamSocialImageIdentitySchema
);
const invalidReviewedTryoutSocialImageRegistryError =
  new InvalidReviewedTryoutSocialImageRegistryError({
    message: "Invalid reviewed try-out social image registry",
  });
const reviewedTryoutSocialImages = Result.mapError(
  Schema.decodeUnknownResult(ReviewedTryoutSocialImageRegistrySchema)(
    reviewedTryoutSocialImageSources
  ),
  constant(invalidReviewedTryoutSocialImageRegistryError)
);
const reviewedTryoutSocialImageByIdentity = Result.map(
  reviewedTryoutSocialImages,
  (images) =>
    new Map(
      images.map((image) => [
        getTryoutSocialImageIdentity(image),
        getReviewedTryoutSocialImagePath(image),
      ])
    )
);
/**
 * Resolves reviewed exam artwork while preserving generated images for every
 * signed route without a matching static asset. Static prerender safety depends
 * on this resolver returning direct Success or Failure values and callers using
 * Effect.runSync, whose fast path avoids starting a fiber and reading time.
 * https://nextjs.org/docs/messages/next-prerender-current-time
 */
export function resolveTryoutExamSocialImage(
  input: unknown
): Effect.Effect<
  string,
  | InvalidReviewedTryoutSocialImageRegistryError
  | InvalidTryoutSocialImageIdentityError
  | TryoutSocialImageIdentityMismatchError
> {
  const decodedIdentity = decodeTryoutExamSocialImageIdentity(input);
  if (Result.isFailure(decodedIdentity)) {
    return Effect.fail(
      new InvalidTryoutSocialImageIdentityError({
        message: "Invalid try-out social image identity",
      })
    );
  }
  const identity = decodedIdentity.success;
  const expectedPublicPath = `try-out/${identity.countryKey}/${identity.examKey}`;
  if (identity.publicPath !== expectedPublicPath) {
    return Effect.fail(
      new TryoutSocialImageIdentityMismatchError({
        actualPublicPath: identity.publicPath,
        expectedPublicPath,
        message: "Try-out social image identity does not match its public path",
      })
    );
  }
  /* istanbul ignore next -- invalid authored registry fails every real resolver fixture */
  if (Result.isFailure(reviewedTryoutSocialImageByIdentity)) {
    return Effect.fail(reviewedTryoutSocialImageByIdentity.failure);
  }
  const reviewedImagePath = reviewedTryoutSocialImageByIdentity.success.get(
    getTryoutSocialImageIdentity(identity)
  );
  return Effect.succeed(
    reviewedImagePath ?? getOgUrl(identity.appLocale, identity.publicPath)
  );
}
function getReviewedTryoutSocialImagePath(image: {
  readonly countryKey: string;
  readonly examKey: string;
  readonly appLocale: string;
}) {
  return `/open-graph/tryout/${image.countryKey}/${image.appLocale}-${image.examKey}.png`;
}
function getTryoutSocialImageIdentity(identity: {
  readonly countryKey: string;
  readonly examKey: string;
  readonly appLocale: string;
}) {
  return `${identity.countryKey}:${identity.appLocale}:${identity.examKey}`;
}
