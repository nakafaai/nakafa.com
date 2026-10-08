import type { Docs } from "@repo/backend/confect/_generated/docs";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { appLocaleValidator } from "@repo/backend/confect/contentRelease/spec";
import { tryoutRouteKeyValidator } from "@repo/backend/confect/tryouts/route";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
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
export type AttemptAccessFields = Pick<
  Docs["tryoutAttempts"],
  | "accessEndsAt"
  | "accessSourceKind"
  | "accessSubscriptionId"
  | "countsForCompetition"
>;
export interface TryoutStartScope {
  readonly countryKey: string;
  readonly examKey: string;
  readonly now: number;
  readonly setKey: string;
  readonly trackKey: string;
  readonly userId: Id<"users">;
}

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
