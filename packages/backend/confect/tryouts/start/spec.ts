import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import tryoutAttempts from "@repo/backend/confect/_generated/tables/tryoutAttempts";
import { appLocaleValidator } from "@repo/backend/confect/contentRelease/spec";
import { tryoutRouteKeyValidator } from "@repo/backend/confect/tryouts/route";
import { Schema, Struct } from "effect";
export const startAttemptArgsValidator = Schema.Struct({
  countryKey: tryoutRouteKeyValidator,
  destinationSectionKey: Schema.optionalKey(tryoutRouteKeyValidator),
  examKey: tryoutRouteKeyValidator,
  entrySectionKey: Schema.optionalKey(tryoutRouteKeyValidator),
  locale: appLocaleValidator,
  setKey: tryoutRouteKeyValidator,
  trackKey: tryoutRouteKeyValidator,
});
export type StartAttemptArgs = typeof startAttemptArgsValidator.Type;
export const startAttemptResultValidator = Schema.Struct({
  attemptId: IdSchema("tryoutAttempts"),
  navigation: Schema.Struct({
    publicPath: Schema.String,
  }),
});
export type StartAttemptResult = typeof startAttemptResultValidator.Type;
export const startAccessArgsValidator = Schema.Struct({
  ...startAttemptArgsValidator.mapFields(Struct.omit(["entrySectionKey"]))
    .fields,
  ...{
    now: Schema.Finite,
  },
});
export type StartAccessArgs = typeof startAccessArgsValidator.Type;
export const tryoutStartAccessValidator = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("free-attempt"),
  }),
  Schema.Struct({
    kind: Schema.Literal("included"),
  }),
]);
export type TryoutStartAccess = typeof tryoutStartAccessValidator.Type;
export const tryoutPaywallSourceValidator = Schema.Literal("review");
export type TryoutPaywallSource = typeof tryoutPaywallSourceValidator.Type;
export const attemptAccessFieldsValidator = tryoutAttempts.Doc.mapFields(
  Struct.pick([
    "accessEndsAt",
    "accessSourceKind",
    "accessSubscriptionId",
    "countsForCompetition",
  ])
);
export type AttemptAccessFields = typeof attemptAccessFieldsValidator.Type;
export const tryoutStartScopeValidator = Schema.Struct({
  countryKey: tryoutRouteKeyValidator,
  examKey: tryoutRouteKeyValidator,
  now: Schema.Finite,
  setKey: tryoutRouteKeyValidator,
  trackKey: tryoutRouteKeyValidator,
  userId: IdSchema("users"),
});
export type TryoutStartScope = typeof tryoutStartScopeValidator.Type;

/** Expected domain failure raised while starting a try-out attempt. */
export class TryoutStartError extends Schema.TaggedError<TryoutStartError>()(
  "TryoutStartError",
  {
    code: Schema.Literals(["TRYOUT_START_FAILED"]),
    message: Schema.String,
  }
) {
  declare readonly message: string;
}

/** Maps a thrown Convex operation into the typed try-out start error channel. */

export function toTryoutStartError() {
  return new TryoutStartError({
    code: "TRYOUT_START_FAILED",
    message: "Unable to start try-out attempt.",
  });
}
