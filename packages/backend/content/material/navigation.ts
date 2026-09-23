import { loadMaterialOwner } from "@repo/backend/content/material/owner";
import type { resolveMaterialRoute } from "@repo/backend/content/material/route";
import { MaterialSource } from "@repo/backend/content/material/source";
import { verifyEffectiveMaterial } from "@repo/backend/content/material/verify";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { MATERIAL_GROUP_LIMIT } from "@repo/backend/convex/contentRelease/material/limits";
import { requireExpectedActiveRelease } from "@repo/backend/convex/contentRelease/runtime/pin";
import { Effect } from "effect";

type AuthenticatedMaterial = NonNullable<
  Effect.Success<ReturnType<typeof resolveMaterialRoute>>["material"]
>;
type MaterialGroup = Pick<
  Doc<"materialCatalog">,
  "appLocale" | "materialKey" | "slot"
>;

/** Authenticates every ordered sibling against one frozen publication sequence. */
export const readMaterialGroup = Effect.fn("contentRelease.readMaterialGroup")(
  function* (
    group: MaterialGroup,
    activeSequence: number,
    requested?: AuthenticatedMaterial
  ) {
    const siblings = yield* (yield* MaterialSource).siblings(
      group.slot,
      group.appLocale,
      group.materialKey,
      MATERIAL_GROUP_LIMIT + 1
    );
    if (siblings.length > MATERIAL_GROUP_LIMIT) {
      return yield* releaseFail(
        "CONTENT_RELEASE_LIMIT",
        `Material ${group.appLocale}/${group.materialKey} exceeds ${MATERIAL_GROUP_LIMIT} lesson sections.`
      );
    }
    const verified = yield* Effect.forEach(siblings, (sibling) => {
      if (requested && sibling.contentKey === requested.row.contentKey) {
        return Effect.succeed(requested);
      }
      return verifyEffectiveMaterial(sibling, activeSequence);
    });
    const parentPath =
      requested?.row.parentPath ?? verified[0]?.projection.parentPath;
    if (
      verified.some(({ projection }) => projection.parentPath !== parentPath)
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Material ${group.appLocale}/${group.materialKey} lost its coherent lesson group.`
      );
    }
    return verified.map(({ projectionJson }) => projectionJson);
  }
);

/** Shares authenticated navigation across lessons in the same release and group. */
export const readMaterialNavigation = Effect.fn(
  "contentRelease.readMaterialNavigation"
)(function* (
  appLocale: MaterialGroup["appLocale"],
  materialKey: string,
  expectedActiveReleaseId: string
) {
  const owner = yield* loadMaterialOwner(appLocale);
  yield* requireExpectedActiveRelease(
    owner.active,
    expectedActiveReleaseId,
    "Material navigation"
  );
  if (!(owner.active && owner.managed && owner.slot)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_MISSING",
      `Signed material navigation is unavailable for ${appLocale}.`
    );
  }
  const siblingJson = yield* readMaterialGroup(
    { appLocale, materialKey, slot: owner.slot },
    owner.active.sequence
  );
  if (siblingJson.length === 0) {
    return yield* releaseFail(
      "CONTENT_RELEASE_MISSING",
      `Material navigation ${appLocale}/${materialKey} is missing.`
    );
  }
  return {
    activeManifestHash: owner.active.manifestHash,
    activeReleaseId: owner.active.releaseId,
    siblingJson,
  };
});
