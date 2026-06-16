import { getCurriculumLensScopeForKind } from "@repo/contents/_types/graph/schema";
import { normalizeGraphRoute } from "@repo/contents/_types/learning-graph";
import { LEARNING_PROGRAM_COVERAGE_ALIGNMENTS } from "@repo/contents/_types/program/alignment";
import { findLearningProgramByKey } from "@repo/contents/_types/program/catalog";
import {
  type CoverageStatus,
  type LearningProgram,
  type LearningProgramCoverageAlignment,
  LearningProgramCoverageInputSchema,
  type LearningProgramCoverageRoute,
} from "@repo/contents/_types/program/schema";
import { Schema } from "effect";

interface CoverageAccumulator {
  contentCount: number;
  programKey: string;
  route: LearningProgramCoverageRoute;
  sampleContentId: string;
}

/** Projects graph-backed route rows into bounded program coverage rows. */
export function createLearningProgramCoverageInputs({
  alignments = LEARNING_PROGRAM_COVERAGE_ALIGNMENTS,
  programs,
  routes,
  syncedAt,
}: {
  alignments?: readonly LearningProgramCoverageAlignment[];
  programs: readonly LearningProgram[];
  routes: readonly LearningProgramCoverageRoute[];
  syncedAt: number;
}) {
  const curriculumRows = createCurriculumCoverageInputs({
    programs,
    routes,
    syncedAt,
  });
  const coveredRouteKeys = new Set(curriculumRows.map(getCoverageRowKey));
  const fallbackRows = createFallbackCoverageInputs({
    alignments,
    programs,
    routes,
    syncedAt,
  }).filter((row) => !coveredRouteKeys.has(getCoverageRowKey(row)));

  return [...curriculumRows, ...fallbackRows].sort(compareCoverageRows);
}

/** Projects routes through the bounded route/lens fallback adapter. */
export function createFallbackCoverageInputs({
  alignments = LEARNING_PROGRAM_COVERAGE_ALIGNMENTS,
  programs,
  routes,
  syncedAt,
}: {
  alignments?: readonly LearningProgramCoverageAlignment[];
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
export function createCurriculumCoverageInputs({
  programs,
  routes,
  syncedAt,
}: {
  programs: readonly LearningProgram[];
  routes: readonly LearningProgramCoverageRoute[];
  syncedAt: number;
}) {
  return createCoverageInputsFromProgramKeys({
    programs,
    resolveProgramKeys: (route) =>
      getProgramKeysForMaterialRoute({ route: route.route }),
    routes,
    syncedAt,
  });
}

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

  return [...rowsByKey.values()]
    .map((row) => {
      const program = findLearningProgramByKey(row.programKey, programs);
      const fallbackStatus = program?.defaultCoverageStatus ?? "planned";

      return Schema.decodeUnknownSync(LearningProgramCoverageInputSchema)({
        contentCount: row.contentCount,
        coverageStatus: getCoverageStatus(fallbackStatus),
        lensId: row.route.lensId,
        lensScope: getCurriculumLensScopeForKind(row.route.kind),
        locale: row.route.locale,
        programKey: row.programKey,
        sampleContentId: row.sampleContentId,
        syncedAt,
      });
    })
    .filter((row) => row.coverageStatus !== "hidden");
}

/** Selects program keys that own the given source-registry route input. */
export function getProgramKeysForCoverageRoute(
  route: LearningProgramCoverageRoute,
  alignments: readonly LearningProgramCoverageAlignment[] = LEARNING_PROGRAM_COVERAGE_ALIGNMENTS
) {
  const directMatches = alignments.filter((alignment) =>
    matchesCoverageAlignment(route, alignment)
  );

  if (directMatches.length > 0) {
    return [...new Set(directMatches.map((alignment) => alignment.programKey))];
  }

  return alignments
    .filter((alignment) => alignment.match.fallback)
    .map((alignment) => alignment.programKey);
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
  const {
    fallback,
    lensSegments: expectedLensSegments,
    routeKinds,
    routeSegments: expectedRouteSegments,
  } = alignment.match;

  if (fallback) {
    return false;
  }

  if (routeKinds?.length && !routeKinds.includes(route.kind)) {
    return false;
  }

  if (expectedLensSegments?.length) {
    const routeLensSegments = route.lensId.split(":");
    const hasLensSegment = expectedLensSegments.some((segment) =>
      routeLensSegments.includes(segment)
    );

    if (!hasLensSegment) {
      return false;
    }
  }

  if (expectedRouteSegments?.length) {
    const routePathSegments = normalizeGraphRoute(route.route)
      .split("/")
      .filter(Boolean);

    return expectedRouteSegments.some((segment) =>
      routePathSegments.includes(segment)
    );
  }

  return true;
}

function getCoverageRowKey(row: {
  lensId: string;
  locale: string;
  programKey: string;
}) {
  return `${row.programKey}|${row.locale}|${row.lensId}`;
}

function compareCoverageRows(
  left: { lensId: string; locale: string; programKey: string },
  right: { lensId: string; locale: string; programKey: string }
) {
  return getCoverageRowKey(left).localeCompare(getCoverageRowKey(right));
}

import { getProgramKeysForMaterialRoute } from "@repo/contents/_types/curriculum/projection";
