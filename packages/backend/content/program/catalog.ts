import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { PROGRAM_CATALOG_LIMIT } from "@repo/backend/confect/contentRelease/program/limits";
import { readSourceRevision } from "@repo/backend/confect/contentRelease/runtime/origin";
import { loadProgramOwner } from "@repo/backend/content/program/owner";
import { ProgramSource } from "@repo/backend/content/program/source";
import {
  verifyCurriculum,
  verifyProgram,
} from "@repo/backend/content/program/verify";
import type { PublicationRow } from "@repo/backend/content/publication/source";
import { Array as Arr, Effect, HashSet, Option } from "effect";

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
  const programKeys = HashSet.fromIterable(Arr.map(programs, ({ key }) => key));
  const treeProgramKeys = Arr.flatMap(programs, (program) =>
    program.navigation.model === "curriculum-tree" ? [program.key] : []
  );
  const rootProgramKeys = HashSet.fromIterable(
    Arr.map(routes, ({ programKey }) => programKey)
  );
  const invalidRoot = Arr.findFirst(
    routes,
    (route) =>
      route.level !== "track" ||
      route.parentPath !== undefined ||
      !HashSet.has(programKeys, route.programKey)
  );
  if (Option.isSome(invalidRoot)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Program root ${invalidRoot.value.appLocale}/${invalidRoot.value.publicPath} lost its program.`
    );
  }
  const missingRoot = Arr.findFirst(
    treeProgramKeys,
    (programKey) => !HashSet.has(rootProgramKeys, programKey)
  );
  if (
    Option.isSome(missingRoot) ||
    HashSet.size(rootProgramKeys) !== routes.length ||
    HashSet.size(rootProgramKeys) !== treeProgramKeys.length
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
    programJson: Arr.map(catalog.programRows, ({ rowJson }) => rowJson),
    routeJson: Arr.map(catalog.routeRows, ({ rowJson }) => rowJson),
    snapshotId: catalog.snapshotId,
    sourceRevision: catalog.sourceRevision,
  };
});
