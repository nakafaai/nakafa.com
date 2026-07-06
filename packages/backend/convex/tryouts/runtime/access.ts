import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { tryoutEntitlementSourceKindCompetition } from "@repo/backend/convex/tryoutAccess/schema";
import { ConvexError } from "convex/values";

const ENTITLEMENT_LOOKUP_LIMIT = 10;

interface AttemptAccessFields {
  accessCampaignId?: Id<"tryoutAccessCampaigns">;
  accessEndsAt: number;
  accessGrantId?: Id<"tryoutAccessGrants">;
  countsForCompetition: boolean;
}

type ActiveEntitlement = Doc<"tryoutEntitlements">;

/** Builds the attempt access snapshot from the entitlement used to start it. */
export function getAttemptAccessFields(
  entitlement: ActiveEntitlement
): AttemptAccessFields {
  const access: AttemptAccessFields = {
    accessEndsAt: entitlement.endsAt,
    countsForCompetition:
      entitlement.sourceKind === tryoutEntitlementSourceKindCompetition,
  };

  if (entitlement.accessCampaignId) {
    access.accessCampaignId = entitlement.accessCampaignId;
  }
  if (entitlement.accessGrantId) {
    access.accessGrantId = entitlement.accessGrantId;
  }

  return access;
}

/** Requires an active entitlement for a concrete set or its parent exam. */
export async function requireActiveEntitlement(
  ctx: MutationCtx,
  args: {
    countryKey: string;
    examKey: string;
    now: number;
    setKey: string;
    userId: Id<"users">;
  }
): Promise<ActiveEntitlement> {
  const setEntitlement = await loadActiveEntitlement(ctx, args);

  if (setEntitlement) {
    return setEntitlement;
  }

  const examEntitlement = await loadActiveEntitlement(ctx, {
    ...args,
    setKey: undefined,
  });

  if (examEntitlement) {
    return examEntitlement;
  }

  throw new ConvexError({
    code: "TRYOUT_ACCESS_REQUIRED",
    message: "Try-out access is required for this set.",
  });
}

/** Loads the newest active entitlement for one exact target. */
async function loadActiveEntitlement(
  ctx: MutationCtx,
  args: {
    countryKey: string;
    examKey: string;
    now: number;
    setKey?: string;
    userId: Id<"users">;
  }
) {
  const entitlements = await ctx.db
    .query("tryoutEntitlements")
    .withIndex(
      "by_userId_and_countryKey_and_examKey_and_setKey_and_startsAt",
      (q) =>
        q
          .eq("userId", args.userId)
          .eq("countryKey", args.countryKey)
          .eq("examKey", args.examKey)
          .eq("setKey", args.setKey)
          .lte("startsAt", args.now)
    )
    .order("desc")
    .take(ENTITLEMENT_LOOKUP_LIMIT);

  return (
    entitlements.find((entitlement) => entitlement.endsAt > args.now) ?? null
  );
}
