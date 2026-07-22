import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { ConvexTaggedError } from "@repo/backend/convex/lib/effect";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import {
  type TryoutAttemptAccessSourceKind,
  tryoutRouteKeyValidator,
} from "@repo/backend/convex/tryouts/schema";
import { ConvexError, type Infer, v } from "convex/values";
import { literals } from "convex-helpers/validators";
import { Schema } from "effect";

export const startAttemptArgsValidator = v.object({
  countryKey: tryoutRouteKeyValidator,
  examKey: tryoutRouteKeyValidator,
  entrySectionKey: v.optional(tryoutRouteKeyValidator),
  locale: localeValidator,
  setKey: tryoutRouteKeyValidator,
  trackKey: tryoutRouteKeyValidator,
});
export type StartAttemptArgs = Infer<typeof startAttemptArgsValidator>;

export const startAttemptResultValidator = v.object({
  attemptId: v.id("tryoutAttempts"),
});
export type StartAttemptResult = Infer<typeof startAttemptResultValidator>;

export const startAccessArgsValidator = startAttemptArgsValidator
  .omit("entrySectionKey")
  .extend({ now: v.number() });
export type StartAccessArgs = Infer<typeof startAccessArgsValidator>;

export const tryoutStartAccessValidator = v.union(
  v.object({ kind: v.literal("free-attempt") }),
  v.object({ kind: v.literal("included") }),
  v.object({ kind: v.literal("upgrade-required") })
);
export type TryoutStartAccess = Infer<typeof tryoutStartAccessValidator>;

export const tryoutPaywallSourceValidator = literals(
  "access-query",
  "start-mutation"
);
export type TryoutPaywallSource = Infer<typeof tryoutPaywallSourceValidator>;

export interface AttemptAccessFields {
  readonly accessCampaignId?: Id<"tryoutAccessCampaigns">;
  readonly accessEndsAt: number;
  readonly accessGrantId?: Id<"tryoutAccessGrants">;
  readonly accessSourceKind: TryoutAttemptAccessSourceKind;
  readonly accessSubscriptionId?: string;
  readonly countsForCompetition: boolean;
}

export interface TryoutStartScope {
  readonly countryKey: string;
  readonly examKey: string;
  readonly now: number;
  readonly setKey: string;
  readonly trackKey: string;
  readonly userId: Id<"users">;
}

export const tryoutStartErrorCode = {
  accessRequired: "TRYOUT_ACCESS_REQUIRED",
  attemptLimitReached: "TRYOUT_ATTEMPT_LIMIT_REACHED",
  failed: "TRYOUT_START_FAILED",
  attemptNotFound: "TRYOUT_ATTEMPT_NOT_FOUND",
  sectionCountMismatch: "TRYOUT_SECTION_COUNT_MISMATCH",
  sectionSnapshotMismatch: "TRYOUT_SECTION_SNAPSHOT_MISMATCH",
} as const;

/** Expected domain failure raised while starting a try-out attempt. */
export class TryoutStartError
  extends Schema.TaggedError<TryoutStartError>()("TryoutStartError", {
    code: Schema.String,
    message: Schema.String,
  })
  implements ConvexTaggedError
{
  declare readonly code: string;
  declare readonly message: string;
}

/** Maps a thrown Convex operation into the typed try-out start error channel. */
export function toTryoutStartError(error: unknown) {
  if (error instanceof TryoutStartError) {
    return error;
  }

  if (error instanceof ConvexError) {
    const data = error.data;

    if (typeof data === "object" && data !== null) {
      const code = "code" in data ? data.code : undefined;
      const message = "message" in data ? data.message : undefined;

      if (typeof code === "string" && typeof message === "string") {
        return new TryoutStartError({ code, message });
      }
    }
  }

  return new TryoutStartError({
    code: tryoutStartErrorCode.failed,
    message: error instanceof Error ? error.message : String(error),
  });
}
