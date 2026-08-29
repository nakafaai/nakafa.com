import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { internalQuery } from "@repo/backend/convex/_generated/server";
import {
  loadRuntimeBundleSource,
  loadRuntimeOwnershipProof,
} from "@repo/backend/convex/contentRelease/retire/runtime";
import {
  type RetirementBundleProof,
  retirementBundleProofValidator,
  retirementBundleSourceValidator,
  retirementInventoryValidator,
} from "@repo/backend/convex/contentRelease/retire/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { Effect } from "effect";

/** Loads the compact permanent state that the Node boundary must authenticate. */
export const loadRetirementInventory = Effect.fn(
  "contentRelease.retire.loadInventory"
)((ctx: QueryCtx) => loadRuntimeOwnershipProof(ctx));

/** Loads one byte pair pinned to hashes from the authenticated inventory. */
export const loadRetirementBundle = Effect.fn(
  "contentRelease.retire.loadBundle"
)((ctx: QueryCtx, expected: RetirementBundleProof) =>
  loadRuntimeBundleSource(ctx, expected)
);

/** Internal inventory available only to the owning Node action. */
export const inventory = internalQuery({
  args: {},
  returns: retirementInventoryValidator,
  handler: (ctx) => runConvexProgram(loadRetirementInventory(ctx)),
});

/** Internal byte source pinned to exact raw hashes from the inventory. */
export const bundle = internalQuery({
  args: retirementBundleProofValidator,
  returns: retirementBundleSourceValidator,
  handler: (ctx, args) => runConvexProgram(loadRetirementBundle(ctx, args)),
});
