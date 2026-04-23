import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  tryoutAccessCampaignRedeemStatusValidator,
  tryoutAccessGrantStatusValidator,
} from "@repo/backend/convex/tryoutAccess/schema";
import { ConvexError, type Infer } from "convex/values";
import { literals } from "convex-helpers/validators";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const ACCESS_STATUS_ACTIVE = "active";
const ACCESS_STATUS_ENDED = "ended";
const ACCESS_STATUS_SCHEDULED = "scheduled";
const GRANT_STATUS_ACTIVE = "active";
const GRANT_STATUS_EXPIRED = "expired";
const UNAVAILABLE_REASON_DISABLED = "disabled";
const UNAVAILABLE_REASON_ENDED = "ended";
const UNAVAILABLE_REASON_NOT_STARTED = "not-started";

export const tryoutAccessUnavailableReasonValidator = literals(
  "invalid-code",
  "disabled",
  "not-started",
  "ended"
);

type TryoutAccessCampaignRedeemStatus = Infer<
  typeof tryoutAccessCampaignRedeemStatusValidator
>;
type TryoutAccessGrantStatus = Infer<typeof tryoutAccessGrantStatusValidator>;
type TryoutAccessUnavailableReason = Infer<
  typeof tryoutAccessUnavailableReasonValidator
>;

/** Calculates the persisted grant end timestamp for one redemption. */
export function getTryoutAccessGrantEndsAt({
  campaign,
  redeemedAt,
}: {
  campaign: Pick<
    Doc<"tryoutAccessCampaigns">,
    "campaignKind" | "endsAt" | "grantDurationDays"
  >;
  redeemedAt: number;
}) {
  if (campaign.campaignKind === "competition") {
    return campaign.endsAt;
  }

  if (campaign.grantDurationDays !== undefined) {
    return redeemedAt + campaign.grantDurationDays * DAY_IN_MS;
  }

  throw new ConvexError({
    code: "INVALID_CAMPAIGN_WINDOW",
    message: "Access-pass campaigns must define grantDurationDays.",
  });
}

/** Resolves the current redeem status for one campaign time window. */
export function getTryoutAccessCampaignRedeemStatus(
  campaign: Pick<Doc<"tryoutAccessCampaigns">, "startsAt" | "endsAt">,
  now: number
): TryoutAccessCampaignRedeemStatus {
  if (campaign.startsAt > now) {
    return ACCESS_STATUS_SCHEDULED;
  }

  if (campaign.endsAt <= now) {
    return ACCESS_STATUS_ENDED;
  }

  return ACCESS_STATUS_ACTIVE;
}

/** Resolves the stored status for one grant end timestamp. */
export function getTryoutAccessGrantStatus(
  endsAt: number,
  now: number
): TryoutAccessGrantStatus {
  if (endsAt <= now) {
    return GRANT_STATUS_EXPIRED;
  }

  return GRANT_STATUS_ACTIVE;
}

/** Explains why a campaign link cannot currently be redeemed. */
export function getTryoutAccessUnavailableReason(eventAccess: {
  campaign: Pick<Doc<"tryoutAccessCampaigns">, "enabled" | "redeemStatus">;
  link: Pick<Doc<"tryoutAccessLinks">, "enabled">;
}): TryoutAccessUnavailableReason | null {
  if (!(eventAccess.link.enabled && eventAccess.campaign.enabled)) {
    return UNAVAILABLE_REASON_DISABLED;
  }

  if (eventAccess.campaign.redeemStatus === "scheduled") {
    return UNAVAILABLE_REASON_NOT_STARTED;
  }

  if (eventAccess.campaign.redeemStatus === "ended") {
    return UNAVAILABLE_REASON_ENDED;
  }

  return null;
}
