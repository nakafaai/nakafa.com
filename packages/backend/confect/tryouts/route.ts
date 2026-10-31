import { KebabKeySchema } from "@nakafa/aksara-contracts/assessment/identity";
import { AppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import { appLocaleValidator } from "@repo/backend/confect/contentRelease/spec";
import { publicFailure } from "@repo/backend/confect/failure";
import { Array as Arr, Effect, Schema } from "effect";
/** Accepts one route key at the Convex transport boundary. */
export const tryoutRouteKeyValidator = Schema.String;
/**
 * The locale-free identity of one set, its keys from the country down (`country/exam/track/set`),
 * which every catalog row of the set carries and an attempt keeps for progress and leaderboards.
 */
export const tryoutSetIdentityOf = (keys: {
  readonly countryKey: string;
  readonly examKey: string;
  readonly setKey: string;
  readonly trackKey: string;
}) =>
  Arr.join([keys.countryKey, keys.examKey, keys.trackKey, keys.setKey], "/");

/** Accepts the fields that identify one localized try-out set. */
export const tryoutSetIdentityValidator = Schema.Struct({
  countryKey: tryoutRouteKeyValidator,
  examKey: tryoutRouteKeyValidator,
  locale: appLocaleValidator,
  setKey: tryoutRouteKeyValidator,
  trackKey: tryoutRouteKeyValidator,
});
export type TryoutSetIdentity = typeof tryoutSetIdentityValidator.Type;
const TryoutSetIdentitySchema = Schema.Struct({
  countryKey: KebabKeySchema,
  examKey: KebabKeySchema,
  locale: AppLocaleCodeSchema,
  setKey: KebabKeySchema,
  trackKey: KebabKeySchema,
});
/** Expected failure while decoding one authored try-out route identity. */
class TryoutRouteError extends Schema.TaggedError<TryoutRouteError>()(
  "TryoutRouteError",
  {
    cause: Schema.optional(Schema.Unknown),
    code: Schema.Literal("TRYOUT_ROUTE_INVALID"),
    message: Schema.String,
  }
) {}
/** Decodes transport strings through the catalog keys of the assessment contract. */
export const TryoutRouteErrorWire = publicFailure(TryoutRouteError);
export const decodeTryoutSetIdentity = Effect.fn(
  "tryouts.route.decodeSetIdentity"
)(function* (input: unknown) {
  return yield* Schema.decodeUnknownEffect(TryoutSetIdentitySchema)(input).pipe(
    Effect.mapError(
      (cause) =>
        new TryoutRouteError({
          cause,
          code: "TRYOUT_ROUTE_INVALID",
          message: "Try-out route identity is invalid.",
        })
    )
  );
});
