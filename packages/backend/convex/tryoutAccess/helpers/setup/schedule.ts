import { internal } from "@repo/backend/convex/_generated/api";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type { TryoutAccessCampaignInput } from "@repo/backend/convex/tryoutAccess/helpers/setup/validators";

/** Schedules the future redeem/finalization transitions for one campaign. */
export async function scheduleCampaignStateTransitions(
  ctx: Pick<MutationCtx, "scheduler">,
  {
    campaign,
    campaignId,
    now,
  }: {
    campaign: TryoutAccessCampaignInput;
    campaignId: Doc<"tryoutAccessCampaigns">["_id"];
    now: number;
  }
) {
  if (campaign.startsAt > now) {
    await ctx.scheduler.runAfter(
      campaign.startsAt - now,
      internal.tryoutAccess.mutations.internal.status.syncCampaignRedeemStatus,
      {
        campaignId,
      }
    );
  }

  if (campaign.endsAt > now) {
    await ctx.scheduler.runAfter(
      campaign.endsAt - now,
      internal.tryoutAccess.mutations.internal.status.syncCampaignRedeemStatus,
      {
        campaignId,
      }
    );
  }

  if (campaign.campaignKind !== "competition") {
    return;
  }

  await ctx.scheduler.runAfter(
    Math.max(0, campaign.endsAt - now),
    internal.tryoutAccess.mutations.internal.competition
      .finalizeCompetitionCampaignResults,
    {
      campaignId,
    }
  );
}
