import {
  isMaterialContentRoute,
  isMaterialLessonRoute,
} from "@repo/contents/_types/route/content";
import type {
  PublicContentRoute,
  PublicCurriculumRoute,
  PublicMaterialLessonRoute,
  PublicMaterialTopicRoute,
} from "@repo/contents/_types/route/schema";
import {
  PublicMaterialLessonRouteSchema,
  PublicMaterialTopicRouteSchema,
} from "@repo/contents/_types/route/schema";
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

/** Reconciles concrete curriculum mappings with active exact material routes. */
export function reconcileMaterialCurriculumRoutes(
  curriculumRoutes: readonly PublicCurriculumRoute[],
  sourceMaterials: readonly PublicContentRoute[],
  reconciledMaterials: readonly PublicContentRoute[],
  model: MaterialSourceModel
) {
  const sourcePaths = new Map<
    string,
    PublicCurriculumRoute["canonicalPath"] | null
  >();
  const activeParentPaths = new Map<
    string,
    Set<PublicMaterialLessonRoute["parentPath"]>
  >();
  const sourceLessons = sourceMaterials.filter(isMaterialLessonRoute);
  const reconciledLessons = reconciledMaterials.filter(isMaterialLessonRoute);
  for (const claim of model.claims) {
    const source = sourceLessons.find(
      (route) =>
        route.locale === claim.locale && route.sourcePath === claim.contentKey
    );
    if (!source) {
      continue;
    }
    if (claim.kind === "missing") {
      sourcePaths.set(`${claim.locale}\0${source.publicPath}`, null);
      continue;
    }
    const replacement = reconciledLessons.find(
      (route) =>
        route.locale === claim.locale && route.sourcePath === claim.contentKey
    );
    if (!replacement) {
      return Effect.fail(
        new PublishedProjectionError({
          locale: claim.locale,
          publicPath: claim.projection.publicPath,
        })
      );
    }
    sourcePaths.set(
      `${claim.locale}\0${source.publicPath}`,
      replacement.publicPath
    );
    const parentIdentity = `${claim.locale}\0${source.materialKey}\0${source.parentPath}`;
    const parents =
      activeParentPaths.get(parentIdentity) ??
      new Set<PublicMaterialLessonRoute["parentPath"]>();
    if (parents.size > 0 && !parents.has(replacement.parentPath)) {
      return Effect.fail(
        new PublishedProjectionError({
          locale: claim.locale,
          publicPath: source.parentPath,
        })
      );
    }
    parents.add(replacement.parentPath);
    activeParentPaths.set(parentIdentity, parents);
  }

  return Effect.succeed(
    curriculumRoutes.map((route) => {
      if (!route.canonicalPath) {
        return route;
      }
      const replacement = sourcePaths.get(
        `${route.locale}\0${route.canonicalPath}`
      );
      const parentReplacement = route.materialKey
        ? activeParentPaths
            .get(
              `${route.locale}\0${route.materialKey}\0${route.canonicalPath}`
            )
            ?.values()
            .next().value
        : undefined;
      const currentPath =
        replacement === undefined ? parentReplacement : replacement;
      if (currentPath === undefined) {
        return route;
      }
      if (currentPath !== null) {
        return { ...route, canonicalPath: currentPath };
      }
      const { canonicalPath: _canonicalPath, ...withoutCanonicalPath } = route;
      return withoutCanonicalPath;
    })
  );
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
  const topicAdditions = new Map<string, PublicMaterialTopicRoute>();
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
    const parentPath = decoded.right.parentPath;
    const existingTopic = routes.find(
      (route) =>
        route.locale === projection.locale && route.publicPath === parentPath
    );
    if (existingTopic) {
      if (
        existingTopic.kind !== "subject-topic" ||
        existingTopic.materialKey !== projection.materialKey
      ) {
        return Effect.fail(
          new PublishedProjectionError({
            locale,
            publicPath: parentPath,
          })
        );
      }
      continue;
    }
    const separator = projection.contentKey.lastIndexOf("/");
    if (separator < 1) {
      return Effect.fail(
        new PublishedProjectionError({
          locale,
          publicPath: parentPath,
        })
      );
    }
    const decodedTopic = Schema.decodeUnknownEither(
      PublicMaterialTopicRouteSchema
    )(
      {
        kind: "subject-topic",
        locale: projection.locale,
        materialKey: projection.materialKey,
        order: 0,
        publicPath: parentPath,
        sitemap: false,
        sourcePath: projection.contentKey.slice(0, separator),
        title: projection.topicTitle,
      },
      { onExcessProperty: "error" }
    );
    if (Either.isLeft(decodedTopic)) {
      return Effect.fail(
        new PublishedProjectionError({
          locale,
          publicPath: parentPath,
        })
      );
    }
    const topicIdentity = `${decodedTopic.right.locale}\0${decodedTopic.right.publicPath}`;
    const existingAddition = topicAdditions.get(topicIdentity);
    if (
      existingAddition &&
      existingAddition.materialKey !== decodedTopic.right.materialKey
    ) {
      return Effect.fail(
        new PublishedProjectionError({
          locale,
          publicPath: parentPath,
        })
      );
    }
    topicAdditions.set(topicIdentity, decodedTopic.right);
  }
  const routesByPath = new Map<string, PublicContentRoute>();
  for (const route of [
    ...retained,
    ...topicAdditions.values(),
    ...additions.values(),
  ]) {
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
