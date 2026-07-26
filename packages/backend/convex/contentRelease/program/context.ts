import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { PROGRAM_RELATED_LIMIT } from "@repo/backend/convex/contentRelease/program/limits";
import { loadProgramRouteRow } from "@repo/backend/convex/contentRelease/program/model";
import { loadProgramOwner } from "@repo/backend/convex/contentRelease/program/owner";
import { verifyCurriculum } from "@repo/backend/convex/contentRelease/program/verify";
import { Effect } from "effect";

/** Resolves one valid curriculum return context for a material identity. */
export const readProgramContext = Effect.fn(
  "contentRelease.readProgramContext"
)(function* (
  ctx: QueryCtx,
  locale: Doc<"curriculumRoutes">["locale"],
  programKey: string,
  nodeKey: string,
  materialKey: string
) {
  const owner = yield* loadProgramOwner(ctx, locale);
  if (!(owner.managed && owner.selected)) {
    return { groupJson: null, managed: false, parentJson: null };
  }
  const { snapshotId } = owner.selected;
  const storedGroup = yield* Effect.promise(() =>
    ctx.db
      .query("curriculumRoutes")
      .withIndex(
        "by_snapshotId_and_locale_and_programKey_and_nodeKey",
        (index) =>
          index
            .eq("snapshotId", snapshotId)
            .eq("locale", locale)
            .eq("programKey", programKey)
            .eq("nodeKey", nodeKey)
      )
      .unique()
  );
  if (!storedGroup) {
    return { groupJson: null, managed: true, parentJson: null };
  }
  const group = yield* verifyCurriculum(storedGroup, snapshotId);
  if (!group.parentPath) {
    return { groupJson: null, managed: true, parentJson: null };
  }
  const storedParent = yield* loadProgramRouteRow(
    ctx,
    snapshotId,
    locale,
    group.parentPath
  );
  if (!storedParent) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Curriculum context ${programKey}/${nodeKey} lost parent ${group.parentPath}.`
    );
  }
  const parent = yield* verifyCurriculum(storedParent, snapshotId);
  if (!(parent.level === "subject" || parent.level === "course")) {
    return { groupJson: null, managed: true, parentJson: null };
  }
  const storedContexts = yield* Effect.promise(() =>
    ctx.db
      .query("curriculumRoutes")
      .withIndex(
        "by_snapshotId_and_locale_and_contextPath_and_order_and_path",
        (index) =>
          index
            .eq("snapshotId", snapshotId)
            .eq("locale", locale)
            .eq("contextPath", parent.publicPath)
      )
      .take(PROGRAM_RELATED_LIMIT + 1)
  );
  if (storedContexts.length > PROGRAM_RELATED_LIMIT) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Curriculum context ${locale}/${parent.publicPath} exceeds ${PROGRAM_RELATED_LIMIT} rows.`
    );
  }
  const contexts = yield* Effect.forEach(storedContexts, (row) =>
    verifyCurriculum(row, snapshotId)
  );
  const ownsMaterial = contexts.some(
    (context) =>
      context.materialContextNodeKey === nodeKey &&
      context.materialContextParentPath === parent.publicPath &&
      context.materialContextPublicPath === group.publicPath &&
      context.materialKey === materialKey &&
      context.programKey === programKey
  );
  if (!ownsMaterial) {
    return { groupJson: null, managed: true, parentJson: null };
  }
  return {
    groupJson: storedGroup.rowJson,
    managed: true,
    parentJson: storedParent.rowJson,
  };
});
