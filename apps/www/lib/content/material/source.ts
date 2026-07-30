import type { MaterialList } from "@repo/contents/_types/curriculum/material";
import { isMaterialLessonRoute } from "@repo/contents/_types/route/content";
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

/** Resolves exact source identities referenced by localized curriculum cards. */
export function readMaterialCardCandidates(
  cards: MaterialList,
  locale: Locale,
  routes: readonly PublicContentRoute[]
) {
  const pathPrefix = `/${locale}/`;
  return cards.flatMap(({ items }) =>
    items.flatMap(({ href }) => {
      const path = href.split("?")[0];
      if (!path.startsWith(pathPrefix)) {
        return [];
      }
      const publicPath = path.slice(pathPrefix.length);
      const material = routes.find(
        (candidate) =>
          candidate.locale === locale && candidate.publicPath === publicPath
      );
      return material && isMaterialLessonRoute(material)
        ? [
            {
              contentKey: material.sourcePath,
              locale: material.locale,
              parentPath: material.parentPath,
            } satisfies MaterialSourceCandidate,
          ]
        : [];
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
  return Effect.succeed([...retained, ...additions.values()]);
}
