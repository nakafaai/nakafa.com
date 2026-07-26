import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { PROGRAM_CATALOG_LIMIT } from "@repo/backend/convex/contentRelease/program/limits";
import { loadProgramOwner } from "@repo/backend/convex/contentRelease/program/owner";
import {
  verifyCurriculum,
  verifyProgram,
} from "@repo/backend/convex/contentRelease/program/verify";
import { readSourceRevision } from "@repo/backend/convex/contentRelease/runtime/origin";
import { Effect } from "effect";

/** Reads the complete bounded program catalog and localized root routes. */
export const readProgramCatalog = Effect.fn(
  "contentRelease.readProgramCatalog"
)(function* (ctx: QueryCtx, locale: Doc<"curriculumRoutes">["locale"]) {
  const owner = yield* loadProgramOwner(ctx, locale);
  if (!(owner.managed && owner.selected)) {
    return {
      activeManifestHash: owner.selected?.active.manifestHash ?? null,
      activeReleaseId: owner.selected?.active.releaseId ?? null,
      managed: false,
      programJson: [],
      routeJson: [],
      snapshotId: owner.selected?.snapshotId ?? null,
      sourceRevision: null,
    };
  }
  const { active, snapshotId } = owner.selected;
  const [programRows, routeRows] = yield* Effect.all([
    Effect.promise(() =>
      ctx.db
        .query("programCatalog")
        .withIndex("by_snapshotId_and_displayOrder_and_programKey", (index) =>
          index.eq("snapshotId", snapshotId)
        )
        .take(PROGRAM_CATALOG_LIMIT + 1)
    ),
    Effect.promise(() =>
      ctx.db
        .query("curriculumRoutes")
        .withIndex(
          "by_snapshotId_and_locale_and_parentPath_and_order_and_path",
          (index) =>
            index
              .eq("snapshotId", snapshotId)
              .eq("locale", locale)
              .eq("parentPath", undefined)
        )
        .take(PROGRAM_CATALOG_LIMIT + 1)
    ),
  ]);
  if (
    programRows.length > PROGRAM_CATALOG_LIMIT ||
    routeRows.length > PROGRAM_CATALOG_LIMIT
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Program catalog exceeds ${PROGRAM_CATALOG_LIMIT} rows.`
    );
  }
  const [programs, routes] = yield* Effect.all([
    Effect.forEach(programRows, (row) => verifyProgram(row, snapshotId)),
    Effect.forEach(routeRows, (row) => verifyCurriculum(row, snapshotId)),
  ]);
  const programKeys = new Set(programs.map(({ key }) => key));
  const treeProgramKeys = programs.flatMap((program) =>
    program.navigation.model === "curriculum-tree" ? [program.key] : []
  );
  const rootProgramKeys = new Set(routes.map(({ programKey }) => programKey));
  const invalidRoot = routes.find(
    (route) =>
      route.level !== "track" ||
      route.parentPath !== undefined ||
      !programKeys.has(route.programKey)
  );
  if (invalidRoot) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Program root ${invalidRoot.locale}/${invalidRoot.publicPath} lost its program.`
    );
  }
  const missingRoot = treeProgramKeys.find(
    (programKey) => !rootProgramKeys.has(programKey)
  );
  if (
    missingRoot ||
    rootProgramKeys.size !== routes.length ||
    rootProgramKeys.size !== treeProgramKeys.length
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Program catalog for ${locale} does not match localized root ownership.`
    );
  }
  return {
    activeManifestHash: active.manifestHash,
    activeReleaseId: active.releaseId,
    managed: true,
    programJson: programRows.map(({ rowJson }) => rowJson),
    routeJson: routeRows.map(({ rowJson }) => rowJson),
    snapshotId,
    sourceRevision: readSourceRevision(active),
  };
});
