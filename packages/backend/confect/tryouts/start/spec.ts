import type { Docs } from "@repo/backend/confect/_generated/docs";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { appLocaleValidator } from "@repo/backend/confect/contentRelease/spec";
import type { ConvexTaggedError } from "@repo/backend/confect/failure";
import { failureWire } from "@repo/backend/confect/failure";
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
export type StartAttemptArgs = Schema.Schema.Type<
  typeof startAttemptArgsValidator
>;
export const startAttemptResultValidator = Schema.Struct({
  attemptId: IdSchema("tryoutAttempts"),
  navigation: Schema.Struct({
    publicPath: Schema.String,
  }),
});
export type StartAttemptResult = Schema.Schema.Type<
  typeof startAttemptResultValidator
>;
export const startAccessArgsValidator = Schema.Struct({
  ...startAttemptArgsValidator.mapFields(Struct.omit(["entrySectionKey"]))
    .fields,
  ...{
    now: Schema.Finite,
  },
});
export type StartAccessArgs = Schema.Schema.Type<
  typeof startAccessArgsValidator
>;
export const tryoutStartAccessValidator = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("free-attempt"),
  }),
  Schema.Struct({
    kind: Schema.Literal("included"),
  }),
]);
export type TryoutStartAccess = Schema.Schema.Type<
  typeof tryoutStartAccessValidator
>;
export const tryoutPaywallSourceValidator = Schema.Literal("review");
export type TryoutPaywallSource = Schema.Schema.Type<
  typeof tryoutPaywallSourceValidator
>;
export type AttemptAccessFields = Pick<
  Docs["tryoutAttempts"],
  | "accessCampaignId"
  | "accessEndsAt"
  | "accessGrantId"
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
export class TryoutStartError
  extends Schema.TaggedError<TryoutStartError>()("TryoutStartError", {
    code: Schema.Literals(["TRYOUT_START_FAILED"]),
    message: Schema.String,
  })
  implements ConvexTaggedError
{
  declare readonly message: string;
}

/** Maps a thrown Convex operation into the typed try-out start error channel. */
/** Public failure payload keeps the domain tag while preserving the deployed code/message transport. */
export const TryoutStartErrorWire = failureWire(TryoutStartError);
export function toTryoutStartError() {
  return new TryoutStartError({
    code: "TRYOUT_START_FAILED",
    message: "Unable to start try-out attempt.",
  });
}
