import { MATERIAL_ROUTE_DOMAINS } from "@repo/contents/_types/material/domain";
import type {
  LessonMaterialSource,
  PracticeMaterialSource,
} from "@repo/contents/_types/material/schema";
import { MATERIAL_SOURCES } from "@repo/contents/_types/material/source";
import {
  comparePublicRouteOrder,
  makePathSync,
  readDomainSlug,
  readNamespaceSegment,
} from "@repo/contents/_types/route/path";
import {
  getPracticeSourceGroupSlug,
  toPublicPracticeGroupSegment,
} from "@repo/contents/_types/route/practice/path";
import {
  type PublicContentRoute,
  PublicContentRouteSchema,
} from "@repo/contents/_types/route/schema";
import { locales } from "@repo/utilities/locales";
import { Schema } from "effect";

/**
 * Projects the default source-controlled material registry for static routes.
 *
 * Next calls `generateStaticParams` during build-time prerendering. This pure
 * reader avoids starting an Effect runtime in that path while the Effect
 * projection remains the validation Interface for sync, tests, and
 * caller-supplied source overrides.
 */
export function readStaticPublicContentRoutes() {
  const routes: PublicContentRoute[] = [];

  for (const material of MATERIAL_SOURCES) {
    if (material.kind === "lesson") {
      routes.push(...readStaticLessonPublicRoutes(material));
      continue;
    }

    routes.push(...readStaticPracticePublicRoutes(material));
  }

  return routes.sort(comparePublicRouteOrder);
}

/** Projects one source-controlled lesson material without starting an Effect runtime. */
function readStaticLessonPublicRoutes(material: LessonMaterialSource) {
  const routes: PublicContentRoute[] = [];

  for (const locale of locales) {
    const topicPath = makePathSync([
      readNamespaceSegment("subject", locale),
      readDomainSlug(MATERIAL_ROUTE_DOMAINS, "lesson", material.domain, locale),
      material.routeSlugs[locale],
    ]);

    routes.push(
      Schema.decodeUnknownSync(PublicContentRouteSchema)({
        description: material.translations[locale].description,
        kind: "subject-topic",
        locale,
        materialKey: material.key,
        order: 0,
        publicPath: topicPath,
        sitemap: false,
        sourcePath: material.assetRoot,
        title: material.translations[locale].title,
      })
    );

    for (const [sectionIndex, section] of material.sections.entries()) {
      const sectionPath = makePathSync([topicPath, section.routeSlugs[locale]]);

      routes.push(
        Schema.decodeUnknownSync(PublicContentRouteSchema)({
          kind: "subject-lesson",
          locale,
          materialKey: material.key,
          order: sectionIndex + 1,
          parentPath: topicPath,
          publicPath: sectionPath,
          sectionKey: section.slug,
          sitemap: true,
          sourcePath: makePathSync([material.assetRoot, section.slug]),
          title: section.translations[locale].title,
        })
      );
    }
  }

  return routes;
}

/** Projects one source-controlled practice material without starting an Effect runtime. */
function readStaticPracticePublicRoutes(material: PracticeMaterialSource) {
  const routes: PublicContentRoute[] = [];

  for (const locale of locales) {
    for (const group of material.groups) {
      const groupPath = makePathSync([
        readNamespaceSegment("exercises", locale),
        material.assessment,
        readDomainSlug(
          MATERIAL_ROUTE_DOMAINS,
          "practice",
          material.domain,
          locale
        ),
        toPublicPracticeGroupSegment(group, locale),
      ]);

      for (const [setIndex, set] of group.sets.entries()) {
        const setPath = makePathSync([groupPath, set.routeSlugs[locale]]);

        routes.push(
          Schema.decodeUnknownSync(PublicContentRouteSchema)({
            description: group.translations[locale].description,
            kind: "exercise-set",
            locale,
            materialKey: material.key,
            order: setIndex + 1,
            parentPath: groupPath,
            publicPath: setPath,
            sectionKey: set.slug,
            sitemap: true,
            sourcePath: makePathSync([
              material.assetRoot,
              getPracticeSourceGroupSlug(group),
              set.slug,
            ]),
            title: set.translations[locale].title,
          })
        );
      }
    }
  }

  return routes;
}
