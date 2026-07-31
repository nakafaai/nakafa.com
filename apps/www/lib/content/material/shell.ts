import type { MaterialLessonProjection } from "@nakafa/aksara-contracts/projection/material";
import { isMaterialLessonRoute } from "@repo/contents/_types/route/content";
import { readStaticPublicContentRoutes } from "@repo/contents/_types/route/content/static";
import { readStaticPublicLearningIndex } from "@repo/contents/_types/route/learning/static";
import type {
  PublicContentRoute,
  PublicMaterialLessonRoute,
} from "@repo/contents/_types/route/schema";
import type { MaterialSourceCandidate } from "@/lib/content/material/ownership";

let materialRouteCache: readonly PublicContentRoute[] | undefined;

/** Lazily decodes content routes when a framework route function needs them. */
export function readMaterialRoutes() {
  if (materialRouteCache) {
    return materialRouteCache;
  }

  materialRouteCache = readStaticPublicContentRoutes();
  return materialRouteCache;
}

/** Resolves one source route and every identity in its temporary shell. */
export function readMaterialSource(
  locale: PublicMaterialLessonRoute["locale"],
  publicPath: string
) {
  const route = readStaticPublicLearningIndex().resolveRouteByPath(
    publicPath,
    locale
  );
  if (route?.kind !== "subject-lesson") {
    return {
      candidates: [] satisfies readonly MaterialSourceCandidate[],
      route: undefined,
    };
  }

  return {
    candidates: collectMaterialCandidates({
      contentKey: route.sourcePath,
      locale: route.locale,
      parentPaths: new Set([route.parentPath]),
    }),
    route,
  };
}

/**
 * Resolves every temporary source identity affected by one active projection.
 *
 * Both the original source group and the active group are included so an exact
 * owner can move between topics without reviving stale or missing siblings.
 */
export function readMaterialCandidates(
  projection: Pick<
    MaterialLessonProjection,
    "contentKey" | "locale" | "parentPath"
  >
) {
  const sourceRoute =
    readStaticPublicLearningIndex().resolveMaterialRouteBySource(
      projection.contentKey,
      projection.locale
    );
  const parentPaths = new Set<string>([projection.parentPath]);
  if (sourceRoute) {
    parentPaths.add(sourceRoute.parentPath);
  }

  const candidates = collectMaterialCandidates({
    contentKey: projection.contentKey,
    locale: projection.locale,
    parentPaths,
  });
  const identity = `${projection.locale}\0${projection.contentKey}`;
  const selected = {
    contentKey: projection.contentKey,
    locale: projection.locale,
    parentPath: projection.parentPath,
  } satisfies MaterialSourceCandidate;
  const selectedIndex = candidates.findIndex(
    (candidate) => `${candidate.locale}\0${candidate.contentKey}` === identity
  );
  if (selectedIndex === -1) {
    return [...candidates, selected];
  }
  return candidates.map((candidate, index) =>
    index === selectedIndex ? selected : candidate
  );
}

/** Expands one source shell with every active group revealed by exact claims. */
export function expandMaterialCandidates(
  candidates: readonly MaterialSourceCandidate[],
  projections: readonly Pick<
    MaterialLessonProjection,
    "contentKey" | "locale" | "parentPath"
  >[]
) {
  const expanded = new Map(
    candidates.map((candidate) => [
      `${candidate.locale}\0${candidate.contentKey}`,
      candidate,
    ])
  );
  for (const projection of projections) {
    for (const candidate of readMaterialCandidates(projection)) {
      if (candidate.locale !== projection.locale) {
        continue;
      }
      expanded.set(`${candidate.locale}\0${candidate.contentKey}`, candidate);
    }
  }
  const result = Array.from(expanded.values());
  const unchanged =
    result.length === candidates.length &&
    result.every((candidate, index) => {
      const current = candidates[index];
      return (
        current?.contentKey === candidate.contentKey &&
        current.locale === candidate.locale &&
        current.parentPath === candidate.parentPath
      );
    });
  return unchanged ? candidates : result;
}

/** Collects locale counterparts and localized siblings for one source shell. */
function collectMaterialCandidates({
  contentKey,
  locale,
  parentPaths,
}: {
  readonly contentKey: string;
  readonly locale: PublicMaterialLessonRoute["locale"];
  readonly parentPaths: ReadonlySet<string>;
}) {
  const candidates = new Map<string, MaterialSourceCandidate>();
  for (const candidate of readMaterialRoutes()) {
    if (
      isMaterialLessonRoute(candidate) &&
      (candidate.sourcePath === contentKey ||
        (candidate.locale === locale && parentPaths.has(candidate.parentPath)))
    ) {
      candidates.set(`${candidate.locale}\0${candidate.sourcePath}`, {
        contentKey: candidate.sourcePath,
        locale: candidate.locale,
        parentPath: candidate.parentPath,
      });
    }
  }
  return Array.from(candidates.values());
}
