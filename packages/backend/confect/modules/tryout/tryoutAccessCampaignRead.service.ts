import type { Id } from "@repo/backend/confect/_generated/dataModel";
import type { ConvexQueryCtx } from "@repo/backend/confect/modules/shared/convexContext";
import { Effect } from "effect";

/** Loads an access campaign when an attempt has one attached. */
export const getTryoutAccessCampaignByOptionalId = Effect.fn(
  "tryouts.accessCampaigns.getByOptionalId"
)(function* (
  ctx: ConvexQueryCtx,
  campaignId: Id<"tryoutAccessCampaigns"> | null | undefined
) {
  if (!campaignId) {
    return null;
  }

  return yield* Effect.promise(() => ctx.db.get(campaignId));
});
