import { loadProgramOwner } from "@repo/backend/content/program/owner";
import { ProgramSource } from "@repo/backend/content/program/source";
import {
  verifyCurriculum,
  verifyProgram,
} from "@repo/backend/content/program/verify";
import type { PublicationRow } from "@repo/backend/content/publication/source";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { PROGRAM_CATALOG_LIMIT } from "@repo/backend/convex/contentRelease/program/limits";
import { readSourceRevision } from "@repo/backend/convex/contentRelease/runtime/origin";
import { Effect } from "effect";

/** Reads and authenticates the complete catalog with localized root closure. */
export const readVerifiedProgramCatalog = Effect.fn(
  "contentRelease.readVerifiedProgramCatalog"
)(function* (appLocale: PublicationRow<"curriculumRoutes">["appLocale"]) {
  const owner = yield* loadProgramOwner(appLocale);
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
  const source = yield* ProgramSource;
  const [programRows, routeRows] = yield* Effect.all([
    source.programs(snapshotId, PROGRAM_CATALOG_LIMIT + 1),
    source.related(
      snapshotId,
      appLocale,
      "children",
      undefined,
      PROGRAM_CATALOG_LIMIT + 1
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
)(function* (appLocale: PublicationRow<"curriculumRoutes">["appLocale"]) {
  const catalog = yield* readVerifiedProgramCatalog(appLocale);

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
