import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { ModelBuildPhase } from "@repo/backend/convex/contentRelease/models/spec";

type ModelBuild = Pick<Doc<"contentModelBuilds">, "slots">;

function changesArticle(build: ModelBuild) {
  return build.slots.articleBaseSlot !== build.slots.articleTargetSlot;
}

function changesMaterial(build: ModelBuild) {
  return build.slots.materialBaseSlot !== build.slots.materialTargetSlot;
}

/** Selects the first required inactive-buffer phase for one release scope. */
export function firstModelPhase(build: ModelBuild): ModelBuildPhase {
  if (changesArticle(build)) {
    return "articleCatalog";
  }
  if (changesMaterial(build)) {
    return "materialCatalog";
  }
  return "ready";
}

/** Selects the next bounded phase while skipping unaffected model families. */
export function nextModelPhase(
  build: ModelBuild,
  phase: ModelBuildPhase
): ModelBuildPhase {
  // Search is owned by article and material changes, as derived by getReadModelImpact.
  const next: Record<ModelBuildPhase, ModelBuildPhase> = {
    articleApply: "articleVerify",
    articleBuckets: "articleApply",
    articleCatalog: "articleCategories",
    articleCategories: "articleBuckets",
    articleVerify: changesMaterial(build) ? "materialCatalog" : "search",
    materialApply: "materialVerify",
    materialCatalog: "materialBuckets",
    materialBuckets: "materialApply",
    materialVerify: "search",
    searchApply: "searchVerify",
    search: "searchApply",
    searchVerify: "ready",
    ready: "ready",
  };
  return next[phase];
}
