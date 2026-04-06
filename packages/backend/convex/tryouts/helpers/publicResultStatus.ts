import type { Doc } from "@repo/backend/convex/_generated/dataModel";

/**
 * Map internal tryout scoring state to the single public label shown to users.
 *
 * Competition attempts switch to `final-event` once the event results are
 * finalized. All other attempts keep the psychometric-facing
 * estimated/verified distinction.
 */
export function getTryoutPublicResultStatus({
  accessCampaign,
  tryoutAttempt,
}: {
  accessCampaign: Pick<Doc<"tryoutAccessCampaigns">, "resultsStatus"> | null;
  tryoutAttempt: Pick<
    Doc<"tryoutAttempts">,
    "accessCampaignKind" | "countsForCompetition" | "scoreStatus"
  >;
}) {
  if (
    tryoutAttempt.accessCampaignKind === "competition" &&
    tryoutAttempt.countsForCompetition
  ) {
    if (accessCampaign?.resultsStatus === "finalized") {
      return "final-event" as const;
    }

    return "estimated" as const;
  }

  if (tryoutAttempt.scoreStatus === "official") {
    return "verified-irt" as const;
  }

  return "estimated" as const;
}
