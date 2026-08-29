import { cleanupProofValidator } from "@repo/backend/convex/tryouts/migration/cleanup/schema";
import { type Infer, v } from "convex/values";

/** Exact raw byte identities authenticated by the Node action. */
export const retirementBundleProofValidator = v.object({
  bundleHash: v.string(),
  bundleJsonHash: v.string(),
  rendererJsonHash: v.string(),
});
export type RetirementBundleProof = Infer<
  typeof retirementBundleProofValidator
>;

/** Compact inventory binding every permanent target to one transaction. */
export const retirementInventoryValidator = v.object({
  bundles: v.array(retirementBundleProofValidator),
  hash: v.string(),
  permanentAttempts: v.number(),
});
export type RetirementInventory = Infer<typeof retirementInventoryValidator>;

/** Raw permanent bytes loaded through one proof-owned content address. */
export const retirementBundleSourceValidator = v.object({
  bundleJson: v.string(),
  rendererJson: v.string(),
});
export type RetirementBundleSource = Infer<
  typeof retirementBundleSourceValidator
>;

const retirementArgsFields = {
  observationId: v.string(),
  proof: cleanupProofValidator,
  receiptJson: v.string(),
};

/** Public input for the single Node-authenticated retirement operation. */
export const retirementArgsValidator = v.object(retirementArgsFields);
export type RetirementArgs = Infer<typeof retirementArgsValidator>;

/** Internal input after Node binds the exact permanent runtime snapshot. */
export const retirementCommitArgsValidator = v.object({
  ...retirementArgsFields,
  runtimeProofHash: v.string(),
});

/** Exact idempotent result of terminal runtime retirement. */
export const retirementResultValidator = v.object({
  deleted: v.union(v.literal(0), v.literal(14)),
  deletedLegacyBundles: v.union(v.literal(0), v.literal(9)),
  migrationId: v.string(),
  observationId: v.string(),
  permanentAttempts: v.number(),
  receiptHash: v.string(),
  retiredAt: v.number(),
});
export type RetirementResult = Infer<typeof retirementResultValidator>;
