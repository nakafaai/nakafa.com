import {
  isMaterialContentRoute,
  isMaterialLessonRoute,
} from "@repo/contents/_types/route/content";
import type {
  PublicContentRoute,
  PublicMaterialLessonRoute,
} from "@repo/contents/_types/route/schema";
import { PublicMaterialLessonRouteSchema } from "@repo/contents/_types/route/schema";
import { Effect, Either, Schema } from "effect";
import type { Locale } from "next-intl";
import type {
  MaterialSourceCandidate,
  MaterialSourceModel,
} from "@/lib/content/material/ownership";
import { PublishedProjectionError } from "@/lib/content/published/errors";

/** Resolves exact source identities referenced by canonical curriculum paths. */
export function readMaterialSourceCandidates(
  paths: readonly string[],
  locale: Locale,
  routes: readonly PublicContentRoute[]
) {
  const candidates = new Map<string, MaterialSourceCandidate>();
  const materials = routes.filter(isMaterialContentRoute);
  for (const path of paths) {
    const material = materials.find(
      (candidate) =>
        candidate.locale === locale && candidate.publicPath === path
    );
    if (!material) {
      continue;
    }
    const lessons = isMaterialLessonRoute(material)
      ? [material]
      : materials.filter(
          (candidate) =>
            isMaterialLessonRoute(candidate) &&
            candidate.locale === locale &&
            candidate.parentPath === material.publicPath
        );
    const sources = lessons.length > 0 ? lessons : [material];
    for (const source of sources) {
      const parentPath = isMaterialLessonRoute(source)
        ? source.parentPath
        : source.publicPath;
      candidates.set(`${source.locale}\0${source.sourcePath}`, {
        contentKey: source.sourcePath,
        locale: source.locale,
        parentPath,
      });
    }
  }
  return Array.from(candidates.values());
}

/**
 * Replaces temporary source lessons with their exact active projections.
 *
 * This pure validation program deliberately returns a fast-path Effect instead
 * of using `Effect.fn`. Static Next.js routes run it synchronously during
 * prerender, where starting a traced Effect fiber would read the current time.
 *
 * @see https://nextjs.org/docs/messages/next-prerender-current-time
 */
export function reconcileMaterialSourceRoutes(
  locale: Locale,
  routes: readonly PublicContentRoute[],
  model: MaterialSourceModel
) {
  const claimed = new Set(
    model.claims.map((claim) => `${claim.locale}\0${claim.contentKey}`)
  );
  const retained = routes.filter(
    (route) => !claimed.has(`${route.locale}\0${route.sourcePath}`)
  );
  const projections = [
    ...model.claims.flatMap((claim) =>
      claim.kind === "found" ? [claim.projection] : []
    ),
    ...model.materials,
  ];
  const additions = new Map<string, PublicMaterialLessonRoute>();
  for (const projection of projections) {
    if (projection.locale !== locale) {
      continue;
    }
    const decoded = Schema.decodeUnknownEither(PublicMaterialLessonRouteSchema)(
      {
        description: projection.metadata.description,
        kind: "subject-lesson",
        locale: projection.locale,
        materialKey: projection.materialKey,
        order: projection.order,
        parentPath: projection.parentPath,
        publicPath: projection.publicPath,
        sectionKey: projection.sectionKey,
        sitemap: true,
        sourcePath: projection.contentKey,
        title: projection.metadata.title,
      },
      { onExcessProperty: "error" }
    );
    if (Either.isLeft(decoded)) {
      return Effect.fail(
        new PublishedProjectionError({
          locale,
          publicPath: projection.publicPath,
        })
      );
    }
    additions.set(
      `${decoded.right.locale}\0${decoded.right.sourcePath}`,
      decoded.right
    );
  }
  const routesByPath = new Map<string, PublicContentRoute>();
  for (const route of [...retained, ...additions.values()]) {
    const identity = `${route.locale}\0${route.publicPath}`;
    if (routesByPath.has(identity)) {
      return Effect.fail(
        new PublishedProjectionError({
          locale: route.locale,
          publicPath: route.publicPath,
        })
      );
    }
    routesByPath.set(identity, route);
  }
  return Effect.succeed(Array.from(routesByPath.values()));
}
