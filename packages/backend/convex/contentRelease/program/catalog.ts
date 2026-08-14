import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { PROGRAM_CATALOG_LIMIT } from "@repo/backend/convex/contentRelease/program/limits";
import { loadProgramOwner } from "@repo/backend/convex/contentRelease/program/owner";
import {
  verifyCurriculum,
  verifyProgram,
} from "@repo/backend/convex/contentRelease/program/verify";
import { readSourceRevision } from "@repo/backend/convex/contentRelease/runtime/origin";
import { Effect } from "effect";

type ProgramCatalogCtx = MutationCtx | QueryCtx;

/** Reads and authenticates the complete catalog with localized root closure. */
export const readVerifiedProgramCatalog = Effect.fn(
  "contentRelease.readVerifiedProgramCatalog"
)(function* (
  ctx: ProgramCatalogCtx,
  appLocale: Doc<"curriculumRoutes">["appLocale"]
) {
  const owner = yield* loadProgramOwner(ctx, appLocale);
  if (!(owner.managed && owner.selected)) {
    return {
      activeManifestHash: owner.selected?.active.manifestHash ?? null,
      activeReleaseId: owner.selected?.active.releaseId ?? null,
      managed: false,
      programs: [],
      programRows: [],
      routes: [],
      routeRows: [],
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
          "by_snapshotId_and_appLocale_and_parentPath_and_order_and_path",
          (index) =>
            index
              .eq("snapshotId", snapshotId)
              .eq("appLocale", appLocale)
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
      `Program root ${invalidRoot.appLocale}/${invalidRoot.publicPath} lost its program.`
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
      `Program catalog for ${appLocale} does not match localized root ownership.`
    );
  }
  return {
    activeManifestHash: active.manifestHash,
    activeReleaseId: active.releaseId,
    managed: true,
    programs,
    programRows,
    routes,
    routeRows,
    snapshotId,
    sourceRevision: readSourceRevision(active),
  };
});

/** Adapts the verified catalog to the public serialized query contract. */
export const readProgramCatalog = Effect.fn(
  "contentRelease.readProgramCatalog"
)(function* (ctx: QueryCtx, appLocale: Doc<"curriculumRoutes">["appLocale"]) {
  const catalog = yield* readVerifiedProgramCatalog(ctx, appLocale);

  return {
    activeManifestHash: catalog.activeManifestHash,
    activeReleaseId: catalog.activeReleaseId,
    managed: catalog.managed,
    programJson: catalog.programRows.map(({ rowJson }) => rowJson),
    routeJson: catalog.routeRows.map(({ rowJson }) => rowJson),
    snapshotId: catalog.snapshotId,
    sourceRevision: catalog.sourceRevision,
  };
});
