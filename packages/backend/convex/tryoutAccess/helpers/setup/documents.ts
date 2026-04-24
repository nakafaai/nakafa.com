import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  TryoutAccessCampaignInput,
  TryoutAccessLinkInput,
} from "@repo/backend/convex/tryoutAccess/helpers/setup/validators";
import { getTryoutAccessCampaignRedeemStatus } from "@repo/backend/convex/tryoutAccess/helpers/status";
import type { WithoutSystemFields } from "convex/server";

type TryoutAccessCampaignDocument = WithoutSystemFields<
  Doc<"tryoutAccessCampaigns">
>;
type TryoutAccessLinkDocument = WithoutSystemFields<Doc<"tryoutAccessLinks">>;

/** Builds the stored campaign document from setup input and existing lifecycle state. */
export function buildTryoutAccessCampaignDocument({
  campaign,
  existingCampaign,
  now,
}: {
  campaign: TryoutAccessCampaignInput;
  existingCampaign: Doc<"tryoutAccessCampaigns"> | null;
  now: number;
}) {
  return {
    campaignKind: campaign.campaignKind,
    enabled: campaign.enabled,
    endsAt: campaign.endsAt,
    grantDurationDays: campaign.grantDurationDays,
    name: campaign.name,
    resultsFinalizedAt: existingCampaign?.resultsFinalizedAt ?? null,
    firstRedeemedAt: existingCampaign?.firstRedeemedAt ?? null,
    resultsStatus: existingCampaign?.resultsStatus ?? "pending",
    redeemStatus: getTryoutAccessCampaignRedeemStatus(campaign, now),
    slug: campaign.slug,
    startsAt: campaign.startsAt,
  } satisfies TryoutAccessCampaignDocument;
}

/** Returns whether the stored campaign document would actually change. */
export function hasStoredCampaignChange(
  existingCampaign: Doc<"tryoutAccessCampaigns">,
  nextCampaign: TryoutAccessCampaignDocument
) {
  return (
    existingCampaign.campaignKind !== nextCampaign.campaignKind ||
    existingCampaign.enabled !== nextCampaign.enabled ||
    existingCampaign.endsAt !== nextCampaign.endsAt ||
    existingCampaign.firstRedeemedAt !== nextCampaign.firstRedeemedAt ||
    existingCampaign.grantDurationDays !== nextCampaign.grantDurationDays ||
    existingCampaign.name !== nextCampaign.name ||
    existingCampaign.redeemStatus !== nextCampaign.redeemStatus ||
    existingCampaign.resultsFinalizedAt !== nextCampaign.resultsFinalizedAt ||
    existingCampaign.resultsStatus !== nextCampaign.resultsStatus ||
    existingCampaign.slug !== nextCampaign.slug ||
    existingCampaign.startsAt !== nextCampaign.startsAt
  );
}

/** Returns whether the stored redeem link document would actually change. */
export function hasStoredLinkChange({
  code,
  existingLink,
  nextLink,
}: {
  code: string;
  existingLink: Doc<"tryoutAccessLinks">;
  nextLink: TryoutAccessLinkDocument;
}) {
  return (
    existingLink.campaignId !== nextLink.campaignId ||
    existingLink.code !== code ||
    existingLink.enabled !== nextLink.enabled ||
    existingLink.label !== nextLink.label
  );
}

/** Returns whether future time-based campaign jobs need fresh scheduling. */
export function hasCampaignTransitionChange({
  existingCampaign,
  nextCampaign,
}: {
  existingCampaign: Pick<
    Doc<"tryoutAccessCampaigns">,
    "campaignKind" | "endsAt" | "startsAt"
  >;
  nextCampaign: Pick<
    TryoutAccessCampaignInput,
    "campaignKind" | "endsAt" | "startsAt"
  >;
}) {
  return (
    existingCampaign.campaignKind !== nextCampaign.campaignKind ||
    existingCampaign.endsAt !== nextCampaign.endsAt ||
    existingCampaign.startsAt !== nextCampaign.startsAt
  );
}

/** Builds the stored redeem link document from setup input. */
export function buildTryoutAccessLinkDocument({
  code,
  existingCampaign,
  link,
}: {
  code: string;
  existingCampaign: Doc<"tryoutAccessCampaigns">;
  link: TryoutAccessLinkInput;
}) {
  return {
    campaignId: existingCampaign._id,
    enabled: link.enabled,
    label: link.label,
    code,
  } satisfies TryoutAccessLinkDocument;
}
