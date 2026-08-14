import { AppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import { TryoutKeySchema } from "@nakafa/aksara-contracts/tryout/key";
import { appLocaleValidator } from "@repo/backend/convex/contentRelease/spec";
import type { ConvexTaggedError } from "@repo/backend/convex/lib/effect";
import { v } from "convex/values";
import { Effect, Schema } from "effect";

/** Accepts one route key at the Convex transport boundary. */
export const tryoutRouteKeyValidator = v.string();

/** Accepts the fields that identify one localized try-out set. */
export const tryoutSetIdentityValidator = v.object({
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
export class TryoutRouteError
  extends Schema.TaggedError<TryoutRouteError>()("TryoutRouteError", {
    cause: Schema.optional(Schema.Unknown),
    code: Schema.Literal("TRYOUT_ROUTE_INVALID"),
    message: Schema.String,
  })
  implements ConvexTaggedError {}

/** Decodes transport strings through the canonical Aksara key contracts. */
export const decodeTryoutSetIdentity = Effect.fn(
  "tryouts.route.decodeSetIdentity"
)(function* (input: unknown) {
  return yield* Schema.decodeUnknown(TryoutSetIdentitySchema)(input).pipe(
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
