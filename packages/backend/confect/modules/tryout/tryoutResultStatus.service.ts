import type { TryoutAccessCampaigns } from "@repo/backend/confect/modules/tryout/access.tables";
import type { TryoutAttempts } from "@repo/backend/confect/modules/tryout/tryouts.tables";

/** Resolves the public result status shown for a tryout attempt. */
export function getTryoutPublicResultStatus(args: {
  readonly accessCampaign: typeof TryoutAccessCampaigns.Doc.Type | null;
  readonly tryoutAttempt: typeof TryoutAttempts.Doc.Type;
}) {
  if (
    args.tryoutAttempt.accessCampaignKind === "competition" &&
    args.tryoutAttempt.countsForCompetition
  ) {
    if (args.accessCampaign?.resultsStatus === "finalized") {
      return "final-event" as const;
    }

    return "estimated" as const;
  }

  if (args.tryoutAttempt.scoreStatus === "official") {
    return "verified-irt" as const;
  }

  return "estimated" as const;
}
