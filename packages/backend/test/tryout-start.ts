import type { TryoutScoring } from "@nakafa/aksara-contracts/tryout/spec";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { tryoutEntitlementSourceKindCompetition } from "@repo/backend/convex/tryoutAccess/schema";
import {
  activateTryoutStartSource,
  TRYOUT_START_COUNTRY,
  TRYOUT_START_EXAM,
  TRYOUT_START_NOW,
  TRYOUT_START_SET,
  TRYOUT_START_TRACK,
} from "@repo/backend/test/tryout-source";

/** Seeds the smallest signed source used by attempt start tests. */
export async function seedTryoutStartSet(
  ctx: MutationCtx,
  args: {
    includeEntitlement?: boolean;
    scoringStrategy?: TryoutScoring;
    userId: Id<"users">;
    visibility: "internal-entry" | "visible";
  }
) {
  const signed = await activateTryoutStartSource(
    ctx,
    args.visibility,
    args.scoringStrategy ?? "raw"
  );

  if (args.includeEntitlement) {
    await ctx.db.insert("tryoutEntitlements", {
      countryKey: TRYOUT_START_COUNTRY,
      endsAt: TRYOUT_START_NOW + 86_400_000,
      examKey: TRYOUT_START_EXAM,
      setKey: TRYOUT_START_SET,
      sourceKind: tryoutEntitlementSourceKindCompetition,
      startsAt: TRYOUT_START_NOW,
      trackKey: TRYOUT_START_TRACK,
      userId: args.userId,
    });
  }

  return signed;
}
