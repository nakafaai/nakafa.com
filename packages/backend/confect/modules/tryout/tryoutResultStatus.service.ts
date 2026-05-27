import type { Doc } from "@repo/backend/confect/_generated/dataModel";

/** Resolves the public result status shown for a tryout attempt. */
export function getTryoutPublicResultStatus(args: {
  readonly accessCampaign: Doc<"tryoutAccessCampaigns"> | null;
  readonly tryoutAttempt: Doc<"tryoutAttempts">;
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
