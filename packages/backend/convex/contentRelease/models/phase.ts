import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { ModelBuildPhase } from "@repo/backend/convex/contentRelease/models/spec";

type ModelBuild = Pick<Doc<"contentModelBuilds">, "slots">;

function changesArticle(build: ModelBuild) {
  return build.slots.articleBaseSlot !== build.slots.articleTargetSlot;
}

function changesMaterial(build: ModelBuild) {
  return build.slots.materialBaseSlot !== build.slots.materialTargetSlot;
}

function changesSearch(build: ModelBuild) {
  return build.slots.searchBaseSlot !== build.slots.searchTargetSlot;
}

/** Selects the first required inactive-buffer phase for one release scope. */
export function firstModelPhase(build: ModelBuild): ModelBuildPhase {
  if (changesArticle(build)) {
    return "articleClearCatalog";
  }
  if (changesMaterial(build)) {
    return "materialClearCatalog";
  }
  if (changesSearch(build)) {
    return "searchClear";
  }
  return "ready";
}

/** Selects the next bounded phase while skipping unaffected model families. */
export function nextModelPhase(
  build: ModelBuild,
  phase: ModelBuildPhase
): ModelBuildPhase {
  const direct: Partial<Record<ModelBuildPhase, ModelBuildPhase>> = {
    articleApply: "articleVerify",
    articleClearBuckets: "articleCopyCatalog",
    articleClearCatalog: "articleClearCategories",
    articleClearCategories: "articleClearBuckets",
    articleCopyBuckets: "articleApply",
    articleCopyCatalog: "articleCopyCategories",
    articleCopyCategories: "articleCopyBuckets",
    materialApply: "materialVerify",
    materialClearCatalog: "materialClearBuckets",
    materialClearBuckets: "materialCopyCatalog",
    materialCopyCatalog: "materialCopyBuckets",
    materialCopyBuckets: "materialApply",
    searchApply: "searchVerify",
    searchClear: "searchCopy",
    searchCopy: "searchApply",
    searchVerify: "ready",
  };
  const next = direct[phase];
  if (next) {
    return next;
  }
  if (phase === "articleVerify") {
    if (changesMaterial(build)) {
      return "materialClearCatalog";
    }
    return changesSearch(build) ? "searchClear" : "ready";
  }
  if (phase === "materialVerify") {
    return changesSearch(build) ? "searchClear" : "ready";
  }
  return phase;
}
