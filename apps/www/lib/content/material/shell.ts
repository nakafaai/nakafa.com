import type { MaterialLessonProjection } from "@nakafa/aksara-contracts/projection/material";
import { isMaterialLessonRoute } from "@repo/contents/_types/route/content";
import { readStaticPublicContentRoutes } from "@repo/contents/_types/route/content/static";
import { readStaticPublicLearningIndex } from "@repo/contents/_types/route/learning/static";
import type {
  PublicContentRoute,
  PublicMaterialLessonRoute,
} from "@repo/contents/_types/route/schema";
import type { MaterialSourceCandidate } from "@/lib/content/material/route";

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

  return collectMaterialCandidates({
    contentKey: projection.contentKey,
    locale: projection.locale,
    parentPaths,
  });
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
      });
    }
  }
  return Array.from(candidates.values());
}
