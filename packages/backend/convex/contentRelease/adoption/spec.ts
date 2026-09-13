import schema from "@repo/backend/convex/schema";
import { type Infer, v } from "convex/values";

/** Temporary, exact per-snapshot adoption identity. Delete after retained readers switch. */
export const adoptionIdentityValidator = v.object({
  candidateReleaseId: v.string(),
  candidateManifestHash: v.string(),
  oldBundleHash: v.string(),
  newBundleHash: v.string(),
});
export type AdoptionIdentity = Infer<typeof adoptionIdentityValidator>;

export const adoptionRequestValidator = adoptionIdentityValidator.extend({
  expectedHistoryHash: v.string(),
});
export type AdoptionRequest = Infer<typeof adoptionRequestValidator>;

export const historyValidator = v.object({
  entries: v.array(
    v.object({
      attempt: schema.doc("tryoutAttempts"),
      placements: v.array(schema.doc("tryoutAttemptPlacements")),
      responses: v.array(schema.doc("tryoutResponses")),
      scores: v.array(schema.doc("tryoutScores")),
      sections: v.array(schema.doc("tryoutSectionAttempts")),
    })
  ),
  scaleEntries: v.array(
    v.object({
      scale: schema.doc("irtScaleVersions"),
      items: v.array(schema.doc("irtScaleItems")),
    })
  ),
});
export type AdoptionHistory = Infer<typeof historyValidator>;

export const adoptionStateValidator = v.object({
  history: historyValidator,
  historyHash: v.string(),
  release: schema.doc("contentReleases"),
  oldBundle: schema.doc("tryoutRuntimeBundles"),
  newBundle: schema.doc("tryoutRuntimeBundles"),
  oldSnapshot: schema.doc("contentSnapshots"),
  newSnapshot: schema.doc("contentSnapshots"),
  placements: v.array(
    v.object({
      prior: schema.doc("tryoutPlacements"),
      next: schema.doc("tryoutPlacements"),
    })
  ),
});
export type AdoptionState = Infer<typeof adoptionStateValidator>;

export const artifactEvidenceValidator = v.object({
  artifactHash: v.string(),
  jsonHash: v.string(),
});
export const commitValidator = adoptionRequestValidator.extend({
  stateHash: v.string(),
  artifacts: v.array(artifactEvidenceValidator),
});
export type AdoptionCommit = Infer<typeof commitValidator>;

export const adoptionReceiptValidator = v.object({
  attempts: v.number(),
  placements: v.number(),
  scores: v.number(),
  scales: v.number(),
  scaleItems: v.number(),
});
