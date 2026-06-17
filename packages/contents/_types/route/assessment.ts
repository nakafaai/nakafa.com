import type { AssessmentSource } from "@repo/contents/_types/assessment/schema";
import { ASSESSMENT_SOURCES } from "@repo/contents/_types/assessment/source";
import type { Locale } from "@repo/contents/_types/content";
import { MATERIAL_ROUTE_DOMAINS } from "@repo/contents/_types/material/domain";
import type { PracticeMaterialSource } from "@repo/contents/_types/material/schema";
import { MATERIAL_SOURCES } from "@repo/contents/_types/material/source";
import { LEARNING_PROGRAM_CATALOG } from "@repo/contents/_types/program/catalog";
import type { LearningProgram } from "@repo/contents/_types/program/schema";
import type { RouteInputs } from "@repo/contents/_types/route/input";
import {
  decodeAssessmentRoute,
  getParentPath,
  lookupNamespaceSegment,
  makePath,
  uniqueRoutes,
} from "@repo/contents/_types/route/path";
import {
  createPracticeMaterialByKey,
  getPracticeActivitySegments,
  makePracticeGroupPath,
} from "@repo/contents/_types/route/practice";
import { findProgram } from "@repo/contents/_types/route/program";
import type { PublicAssessmentRoute } from "@repo/contents/_types/route/schema";
import type { PublicRouteSegment } from "@repo/contents/_types/route/segment";
import { locales } from "@repo/utilities/locales";
import { Effect } from "effect";

/** Projects assessment-owned structure into localized exam context routes. */
export const listPublicAssessmentRoutes = Effect.fn(
  "contents.route.listAssessments"
)(function* ({
  assessments = ASSESSMENT_SOURCES,
  domains = MATERIAL_ROUTE_DOMAINS,
  materials = MATERIAL_SOURCES,
  programs = LEARNING_PROGRAM_CATALOG,
}: RouteInputs = {}) {
  const practiceMaterialByKey = createPracticeMaterialByKey(materials);
  const routes: PublicAssessmentRoute[] = [];

  for (const assessment of assessments) {
    const program = yield* findProgram(assessment.programKey, programs);
    const nodeByKey = new Map(assessment.nodes.map((node) => [node.key, node]));

    for (const locale of locales) {
      const rootPath = yield* makeAssessmentProgramPath(program, locale);

      routes.push(
        yield* decodeAssessmentRoute({
          description: program.translations[locale].description,
          kind: "assessment-context",
          level: "section",
          locale,
          nodeKey: `${program.key}:root`,
          programKey: program.key,
          publicPath: rootPath,
          sitemap: assessment.nodes.some(
            (node) => node.materialKeys.length > 0
          ),
          title: program.translations[locale].title,
        })
      );
    }

    for (const node of assessment.nodes) {
      if (
        node.materialKeys.length === 0 &&
        !hasAssessmentMaterialChild(node.key, assessment)
      ) {
        continue;
      }

      for (const locale of locales) {
        const nodePathSegments = yield* getAssessmentNodePathSegments({
          locale,
          node,
          nodeByKey,
        });
        const programPath = yield* makeAssessmentProgramPath(program, locale);
        const publicPath = yield* makePath([programPath, ...nodePathSegments]);

        if (publicPath === programPath) {
          continue;
        }

        const materialKey = node.materialKeys.at(0);

        routes.push(
          yield* decodeAssessmentRoute({
            canonicalPath: yield* getAssessmentCanonicalPath({
              domains,
              locale,
              materialKey,
              practiceMaterialByKey,
            }),
            description: node.translations[locale].description,
            kind: "assessment-context",
            level: node.level,
            locale,
            materialKey,
            nodeKey: node.key,
            parentPath: getParentPath(publicPath),
            programKey: assessment.programKey,
            publicPath,
            sitemap: materialKey !== undefined,
            title: node.translations[locale].title,
          })
        );

        if (!materialKey) {
          continue;
        }

        const material = practiceMaterialByKey.get(materialKey);

        if (!material) {
          continue;
        }

        for (const group of material.groups) {
          const groupSegments = getPracticeActivitySegments(group, locale);
          const groupPath = yield* makePath([publicPath, ...groupSegments]);
          const groupKey = groupSegments.join("-");

          routes.push(
            yield* decodeAssessmentRoute({
              canonicalPath: yield* makePracticeGroupPath({
                domains,
                group,
                locale,
                material,
              }),
              description: group.translations[locale].description,
              kind: "assessment-context",
              level: "practice-set",
              locale,
              materialKey,
              nodeKey: `${node.key}:${groupKey}`,
              parentPath: publicPath,
              programKey: assessment.programKey,
              publicPath: groupPath,
              sitemap: true,
              title: group.translations[locale].title,
            })
          );
        }
      }
    }
  }

  return yield* uniqueRoutes(routes);
});

/** Checks whether a source node should render because a descendant maps material. */
function hasAssessmentMaterialChild(
  nodeKey: string,
  assessment: AssessmentSource
) {
  return assessment.nodes.some(
    (node) => node.parentKey === nodeKey && node.materialKeys.length > 0
  );
}

/** Reads source-owned assessment ancestry segments while omitting the duplicated root section. */
function getAssessmentNodePathSegments({
  locale,
  node,
  nodeByKey,
}: {
  locale: Locale;
  node: AssessmentSource["nodes"][number];
  nodeByKey: ReadonlyMap<string, AssessmentSource["nodes"][number]>;
}) {
  const nodes: AssessmentSource["nodes"][number][] = [];
  let current: AssessmentSource["nodes"][number] | undefined = node;

  while (current) {
    nodes.unshift(current);
    current = current.parentKey ? nodeByKey.get(current.parentKey) : undefined;
  }

  if (nodes[0]?.level === "section") {
    nodes.shift();
  }

  const segments: PublicRouteSegment[] = [];

  for (const item of nodes) {
    segments.push(item.translations[locale].routeSlug);
  }

  return Effect.succeed(segments);
}

/** Reads the canonical practice group path for an assessment material context. */
function getAssessmentCanonicalPath({
  domains,
  locale,
  materialKey,
  practiceMaterialByKey,
}: {
  domains: NonNullable<RouteInputs["domains"]>;
  locale: Locale;
  materialKey: string | undefined;
  practiceMaterialByKey: ReadonlyMap<string, PracticeMaterialSource>;
}) {
  return Effect.gen(function* () {
    if (!materialKey) {
      return;
    }

    const material = practiceMaterialByKey.get(materialKey);
    const group = material?.groups.at(0);

    if (!(material && group)) {
      return;
    }

    return yield* makePracticeGroupPath({
      domains,
      group,
      locale,
      material,
    });
  });
}

/** Builds the localized assessment root path from the program-owned public slug. */
function makeAssessmentProgramPath(program: LearningProgram, locale: Locale) {
  return Effect.gen(function* () {
    return yield* makePath([
      yield* lookupNamespaceSegment("assessment", locale),
      program.translations[locale].publicSlug,
    ]);
  });
}
