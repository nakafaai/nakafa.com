import {
  getProgramKeysForMaterialRouteFromNodes,
  type ProjectedCurriculumNode,
  projectCurriculumNodes,
} from "@repo/contents/_types/curriculum/projection";
import { getCurriculumLensScopeForKind } from "@repo/contents/_types/graph/schema";
import { normalizeGraphRoute } from "@repo/contents/_types/learning-graph";
import { LEARNING_PROGRAM_COVERAGE_ALIGNMENTS } from "@repo/contents/_types/program/alignment";
import { findLearningProgramByKey } from "@repo/contents/_types/program/catalog";
import {
  type CoverageStatus,
  type LearningProgram,
  type LearningProgramCoverageAlignment,
  type LearningProgramCoverageInput,
  LearningProgramCoverageInputSchema,
  type LearningProgramCoverageRoute,
} from "@repo/contents/_types/program/schema";
import { Effect, Schema } from "effect";

interface CoverageAccumulator {
  contentCount: number;
  programKey: string;
  route: LearningProgramCoverageRoute;
  sampleContentId: string;
}

interface LearningProgramCoverageInputsArgs {
  alignments?: readonly LearningProgramCoverageAlignment[];
  curriculumNodes?: readonly ProjectedCurriculumNode[];
  programs: readonly LearningProgram[];
  routes: readonly LearningProgramCoverageRoute[];
  syncedAt: number;
}

/** Projects coverage rows at sync boundaries after loading curriculum mappings. */
export const projectLearningProgramCoverageInputs = Effect.fn(
  "contents.program.projectLearningProgramCoverageInputs"
)(function* (args: LearningProgramCoverageInputsArgs) {
  const curriculumNodes =
    args.curriculumNodes ?? (yield* projectCurriculumNodes());

  return createLearningProgramCoverageInputs({
    ...args,
    curriculumNodes,
  });
});

/** Projects graph-backed route rows into bounded program coverage rows. */
function createLearningProgramCoverageInputs({
  alignments = LEARNING_PROGRAM_COVERAGE_ALIGNMENTS,
  curriculumNodes,
  programs,
  routes,
  syncedAt,
}: LearningProgramCoverageInputsArgs & {
  curriculumNodes: readonly ProjectedCurriculumNode[];
}) {
  const curriculumRows = createCurriculumCoverageInputs({
    curriculumNodes,
    programs,
    routes,
    syncedAt,
  });
  const coveredRouteKeys = new Set(curriculumRows.map(getCoverageRowKey));
  const alignedRows = createAlignedCoverageInputs({
    alignments,
    programs,
    routes,
    syncedAt,
  }).filter((row) => !coveredRouteKeys.has(getCoverageRowKey(row)));

  return [...curriculumRows, ...alignedRows].sort(compareCoverageRows);
}

/** Projects routes through the bounded route-and-lens alignment registry. */
function createAlignedCoverageInputs({
  alignments,
  programs,
  routes,
  syncedAt,
}: {
  alignments: readonly LearningProgramCoverageAlignment[];
  programs: readonly LearningProgram[];
  routes: readonly LearningProgramCoverageRoute[];
  syncedAt: number;
}) {
  return createCoverageInputsFromProgramKeys({
    programs,
    resolveProgramKeys: (route) =>
      getProgramKeysForCoverageRoute(route, alignments),
    routes,
    syncedAt,
  });
}

/** Projects routes through curriculum-owned material mappings. */
function createCurriculumCoverageInputs({
  curriculumNodes,
  programs,
  routes,
  syncedAt,
}: {
  curriculumNodes: readonly ProjectedCurriculumNode[];
  programs: readonly LearningProgram[];
  routes: readonly LearningProgramCoverageRoute[];
  syncedAt: number;
}) {
  function resolveProgramKeys(route: LearningProgramCoverageRoute) {
    return getProgramKeysForMaterialRouteFromNodes({
      curriculumNodes,
      route: route.sourcePath,
    });
  }

  return createCoverageInputsFromProgramKeys({
    programs,
    resolveProgramKeys,
    routes,
    syncedAt,
  });
}

/** Aggregates route coverage by program, locale, and lens while preserving stable sample content IDs. */
function createCoverageInputsFromProgramKeys({
  programs,
  resolveProgramKeys,
  routes,
  syncedAt,
}: {
  programs: readonly LearningProgram[];
  resolveProgramKeys: (
    route: LearningProgramCoverageRoute
  ) => readonly string[];
  routes: readonly LearningProgramCoverageRoute[];
  syncedAt: number;
}) {
  const rowsByKey = new Map<string, CoverageAccumulator>();

  for (const route of routes) {
    const programKeys = resolveProgramKeys(route);

    for (const programKey of programKeys) {
      const key = `${programKey}|${route.locale}|${route.lensId}`;
      const existing = rowsByKey.get(key);

      if (existing) {
        existing.contentCount++;
        continue;
      }

      rowsByKey.set(key, {
        contentCount: 1,
        programKey,
        route,
        sampleContentId: route.assetId,
      });
    }
  }

  const coverageRows: LearningProgramCoverageInput[] = [];

  for (const row of rowsByKey.values()) {
    const program = findLearningProgramByKey(row.programKey, programs);
    const fallbackStatus = program?.defaultCoverageStatus ?? "planned";
    const coverageRow = Schema.decodeUnknownSync(
      LearningProgramCoverageInputSchema
    )({
      contentCount: row.contentCount,
      coverageStatus: getCoverageStatus(fallbackStatus),
      lensId: row.route.lensId,
      lensScope: getCurriculumLensScopeForKind(row.route.kind),
      locale: row.route.locale,
      programKey: row.programKey,
      sampleContentId: row.sampleContentId,
      syncedAt,
    });

    if (coverageRow.coverageStatus === "hidden") {
      continue;
    }

    coverageRows.push(coverageRow);
  }

  return coverageRows;
}

/** Selects program keys that own the given source-registry route input. */
function getProgramKeysForCoverageRoute(
  route: LearningProgramCoverageRoute,
  alignments: readonly LearningProgramCoverageAlignment[]
) {
  const directMatches = alignments.filter((alignment) =>
    matchesCoverageAlignment(route, alignment)
  );

  if (directMatches.length > 0) {
    return [...new Set(directMatches.map((alignment) => alignment.programKey))];
  }

  return [];
}

/** Keeps planned/hidden catalog states honest while surfacing real graph coverage. */
function getCoverageStatus(defaultStatus: CoverageStatus): CoverageStatus {
  if (defaultStatus === "hidden" || defaultStatus === "archived") {
    return defaultStatus;
  }

  if (defaultStatus === "available") {
    return "available";
  }

  return "partial";
}

/** Returns true when one route satisfies one centralized coverage ownership rule. */
function matchesCoverageAlignment(
  route: LearningProgramCoverageRoute,
  alignment: LearningProgramCoverageAlignment
) {
  const { lensSegments, routeSegments } = alignment.match;
  const routeLensSegments = new Set(route.lensId.split(":"));
  const hasLensSegment = lensSegments.some((segment) =>
    routeLensSegments.has(segment)
  );

  if (!hasLensSegment) {
    return false;
  }

  const routePathSegments = new Set(
    normalizeGraphRoute(route.route).split("/").filter(Boolean)
  );

  return routeSegments.some((segment) => routePathSegments.has(segment));
}

/** Builds the stable dedupe/sort key for one generated program coverage row. */
function getCoverageRowKey(row: {
  lensId: string;
  locale: string;
  programKey: string;
}) {
  return `${row.programKey}|${row.locale}|${row.lensId}`;
}

/** Orders generated coverage rows deterministically for sync and tests. */
function compareCoverageRows(
  left: { lensId: string; locale: string; programKey: string },
  right: { lensId: string; locale: string; programKey: string }
) {
  return getCoverageRowKey(left).localeCompare(getCoverageRowKey(right));
}
