import type { Id } from "@repo/backend/confect/_generated/dataModel";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { Effect } from "effect";

/** Loads an access campaign when an attempt has one attached. */
export const getTryoutAccessCampaignByOptionalId = Effect.fn(
  "tryouts.accessCampaigns.getByOptionalId"
)(function* (campaignId: Id<"tryoutAccessCampaigns"> | null | undefined) {
  if (!campaignId) {
    return null;
  }

  const reader = yield* DatabaseReader;
  return yield* reader
    .table("tryoutAccessCampaigns")
    .get(campaignId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));
});
