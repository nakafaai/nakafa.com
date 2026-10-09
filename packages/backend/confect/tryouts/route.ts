import { AppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import { TryoutKeySchema } from "@nakafa/aksara-contracts/tryout/key";
import { appLocaleValidator } from "@repo/backend/confect/contentRelease/spec";
import { publicFailure } from "@repo/backend/confect/failure";
import { Effect, Schema } from "effect";
/** Accepts one route key at the Convex transport boundary. */
export const tryoutRouteKeyValidator = Schema.String;
/** Accepts the fields that identify one localized try-out set. */
export const tryoutSetIdentityValidator = Schema.Struct({
  countryKey: tryoutRouteKeyValidator,
  examKey: tryoutRouteKeyValidator,
  locale: appLocaleValidator,
  setKey: tryoutRouteKeyValidator,
  trackKey: tryoutRouteKeyValidator,
});
const TryoutSetIdentitySchema = Schema.Struct({
  countryKey: TryoutKeySchema,
  examKey: TryoutKeySchema,
  locale: AppLocaleCodeSchema,
  setKey: TryoutKeySchema,
  trackKey: TryoutKeySchema,
});
/** Expected failure while decoding one authored try-out route identity. */
export class TryoutRouteError extends Schema.TaggedError<TryoutRouteError>()(
  "TryoutRouteError",
  {
    cause: Schema.optional(Schema.Unknown),
    code: Schema.Literal("TRYOUT_ROUTE_INVALID"),
    message: Schema.String,
  }
) {}
/** Decodes transport strings through the canonical Aksara key contracts. */
export const TryoutRouteErrorWire = publicFailure(TryoutRouteError);
export const decodeTryoutSetIdentity = Effect.fn(
  "tryouts.route.decodeSetIdentity"
)(function* (input: unknown) {
  return yield* Schema.decodeUnknownEffect(TryoutSetIdentitySchema)(input).pipe(
    Effect.mapError((cause) =>
      TryoutRouteError.make({
        cause,
        code: "TRYOUT_ROUTE_INVALID",
        message: "Try-out route identity is invalid.",
      })
    )
  );
});
