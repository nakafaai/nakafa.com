import { ExercisesMaterialSchema } from "@repo/contents/_types/assessment/material";
import {
  type AssessmentSource,
  AssessmentSourceSchema,
} from "@repo/contents/_types/assessment/schema";
import { ASSESSMENT_SOURCES } from "@repo/contents/_types/assessment/source";
import { ExercisesTypeSchema } from "@repo/contents/_types/assessment/type";
import type { Locale } from "@repo/contents/_types/content";
import {
  listCurriculumNodesEffect,
  type ProjectedCurriculumNode,
  ProjectedCurriculumNodeSchema,
} from "@repo/contents/_types/curriculum/projection";
import {
  type CurriculumSource,
  CurriculumSourceSchema,
} from "@repo/contents/_types/curriculum/schema";
import { CURRICULUM_SOURCES } from "@repo/contents/_types/curriculum/source";
import {
  MATERIAL_ROUTE_DOMAINS,
  type MaterialRouteDomain,
  MaterialRouteDomainSchema,
} from "@repo/contents/_types/material/domain";
import type {
  LessonMaterialSource,
  MaterialSource,
  PracticeMaterialGroup,
  PracticeMaterialSource,
} from "@repo/contents/_types/material/schema";
import { MaterialSourceSchema } from "@repo/contents/_types/material/schema";
import { MATERIAL_SOURCES } from "@repo/contents/_types/material/source";
import { LEARNING_PROGRAM_CATALOG } from "@repo/contents/_types/program/catalog";
import type {
  LearningProgram,
  LearningProgramKey,
} from "@repo/contents/_types/program/schema";
import { LearningProgramSchema } from "@repo/contents/_types/program/schema";
import {
  DuplicatePublicRouteError,
  InvalidPublicRouteSourceError,
  MissingPublicSlugError,
} from "@repo/contents/_types/route/error";
import {
  type PublicAssessmentRoute,
  PublicAssessmentRouteSchema,
  type PublicContentRoute,
  PublicContentRouteSchema,
  type PublicCurriculumRoute,
  PublicCurriculumRouteSchema,
  type PublicRoute,
  PublicRoutePathSchema,
  type PublicRouteSegment,
  PublicRouteSegmentSchema,
} from "@repo/contents/_types/route/schema";
import {
  PUBLIC_ROUTE_SURFACES,
  type PublicRouteSurfaceKey,
} from "@repo/contents/_types/route/surface";
import { locales } from "@repo/utilities/locales";
import { Effect, Option, Schema } from "effect";

export type PublicRouteProjectionError =
  | DuplicatePublicRouteError
  | InvalidPublicRouteSourceError
  | MissingPublicSlugError;

const RouteInputsSchema = Schema.Struct({
  assessments: Schema.optional(Schema.Array(AssessmentSourceSchema)),
  curricula: Schema.optional(Schema.Array(CurriculumSourceSchema)),
  curriculumNodes: Schema.optional(Schema.Array(ProjectedCurriculumNodeSchema)),
  domains: Schema.optional(Schema.Array(MaterialRouteDomainSchema)),
  materials: Schema.optional(Schema.Array(MaterialSourceSchema)),
  programs: Schema.optional(Schema.Array(LearningProgramSchema)),
});

type RouteInputs = Schema.Schema.Type<typeof RouteInputsSchema>;

const ExerciseQuestionPathInputSchema = Schema.Struct({
  assessment: ExercisesTypeSchema,
  domain: ExercisesMaterialSchema,
  exerciseType: PublicRouteSegmentSchema,
  locale: Schema.Literal(...locales),
  number: Schema.Int.pipe(Schema.greaterThanOrEqualTo(1)),
  setName: PublicRouteSegmentSchema,
  year: Schema.optional(Schema.Int.pipe(Schema.between(2000, 2100))),
});

export type ExerciseQuestionPathInput = Schema.Schema.Encoded<
  typeof ExerciseQuestionPathInputSchema
> &
  Pick<RouteInputs, "domains" | "materials">;

function isPracticeMaterialSource(
  material: MaterialSource
): material is PracticeMaterialSource {
  return material.kind === "practice";
}

export type PublicRouteNamespace = PublicRouteSurfaceKey;

export const getPublicRouteNamespaceEffect = Effect.fn(
  "contents.route.namespace"
)(function* (namespace: PublicRouteNamespace, locale: Locale) {
  return yield* lookupNamespaceSegmentEffect(namespace, locale);
});

export const listPublicRoutesEffect = Effect.fn("contents.route.listAll")(
  function* (inputs: RouteInputs = {}) {
    const routes = yield* Effect.all([
      listPublicContentRoutesEffect(inputs),
      listPublicCurriculumRoutesEffect(inputs),
      listPublicAssessmentRoutesEffect(inputs),
    ]);

    return yield* uniqueRoutesEffect(routes.flat());
  }
);

export const listPublicContentRoutesEffect = Effect.fn(
  "contents.route.listContent"
)(function* ({
  domains = MATERIAL_ROUTE_DOMAINS,
  materials = MATERIAL_SOURCES,
}: Pick<RouteInputs, "domains" | "materials"> = {}) {
  const routes: PublicContentRoute[] = [];

  for (const material of materials) {
    const materialRoutes =
      material.kind === "lesson"
        ? yield* listLessonPublicRoutesEffect(material, domains)
        : yield* listPracticePublicRoutesEffect(material, domains);

    routes.push(...materialRoutes);
  }

  return yield* uniqueRoutesEffect(routes);
});

export const listPublicCurriculumRoutesEffect = Effect.fn(
  "contents.route.listCurricula"
)(function* ({
  curricula = CURRICULUM_SOURCES,
  curriculumNodes,
  domains = MATERIAL_ROUTE_DOMAINS,
  materials = MATERIAL_SOURCES,
  programs = LEARNING_PROGRAM_CATALOG,
}: RouteInputs = {}) {
  const contentRouteByMaterialKey = yield* createTopicRouteByMaterialKeyEffect({
    domains,
    materials,
  });
  const projectedNodes =
    curriculumNodes ??
    (yield* listCurriculumNodesEffect({ curricula, materials }).pipe(
      Effect.mapError(
        (error) =>
          new InvalidPublicRouteSourceError({
            message: error.message,
          })
      )
    ));
  const nodeByKey = createCurriculumNodeMap(projectedNodes);
  const descendantMaterials = createDescendantMaterialMap(projectedNodes);
  const routes: PublicCurriculumRoute[] = [];

  for (const curriculum of curricula) {
    if (!hasCurriculumMaterialDescendant(curriculum, descendantMaterials)) {
      continue;
    }

    const program = yield* findProgramEffect(programs, curriculum.programKey);

    for (const locale of locales) {
      const namespace = yield* lookupNamespaceSegmentEffect(
        "curriculum",
        locale
      );
      const programPath = yield* makePathEffect([
        namespace,
        program.translations[locale].publicSlug,
      ]);

      routes.push(
        yield* decodeCurriculumRouteEffect({
          description: program.translations[locale].description,
          kind: "curriculum-context",
          level: "track",
          locale,
          nodeKey: `${program.key}:root`,
          programKey: program.key,
          publicPath: programPath,
          sitemap: true,
          title: program.translations[locale].title,
        })
      );
    }
  }

  for (const node of projectedNodes) {
    const materialKeys = descendantMaterials.get(getCurriculumNodeMapKey(node));

    if (!materialKeys || materialKeys.size === 0) {
      continue;
    }

    const program = yield* findProgramEffect(programs, node.curriculumKey);

    for (const locale of locales) {
      const nodePathSegments = yield* getCurriculumNodePathSegmentsEffect({
        contentRouteByMaterialKey,
        locale,
        node,
        nodeByKey,
      });

      const namespace = yield* lookupNamespaceSegmentEffect(
        "curriculum",
        locale
      );
      const programPath = yield* makePathEffect([
        namespace,
        program.translations[locale].publicSlug,
      ]);
      const publicPath = yield* makePathEffect([
        programPath,
        ...nodePathSegments,
      ]);
      const materialKey = node.materialKeys.at(0);
      const canonicalPath = materialKey
        ? contentRouteByMaterialKey.get(`${locale}:${materialKey}`)?.publicPath
        : undefined;

      routes.push(
        yield* decodeCurriculumRouteEffect({
          canonicalPath,
          description: node.translations[locale].description,
          kind: "curriculum-context",
          level: node.level,
          locale,
          materialDomain: node.materialDomain,
          materialKey,
          nodeKey: node.key,
          parentPath: getParentPath(publicPath),
          programKey: node.curriculumKey,
          publicPath,
          sitemap:
            canonicalPath !== undefined || node.materialKeys.length === 0,
          title: node.translations[locale].title,
        })
      );
    }
  }

  return yield* uniqueRoutesEffect(routes);
});

export const listPublicAssessmentRoutesEffect = Effect.fn(
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
    const program = yield* findProgramEffect(programs, assessment.programKey);
    const nodeByKey = new Map(assessment.nodes.map((node) => [node.key, node]));

    for (const locale of locales) {
      const rootPath = yield* makeAssessmentProgramPathEffect(program, locale);

      routes.push(
        yield* decodeAssessmentRouteEffect({
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
        const nodePathSegments = yield* getAssessmentNodePathSegmentsEffect({
          locale,
          node,
          nodeByKey,
        });
        const programPath = yield* makeAssessmentProgramPathEffect(
          program,
          locale
        );
        const publicPath = yield* makePathEffect([
          programPath,
          ...nodePathSegments,
        ]);

        if (publicPath === programPath) {
          continue;
        }

        const materialKey = node.materialKeys.at(0);

        routes.push(
          yield* decodeAssessmentRouteEffect({
            canonicalPath: yield* getAssessmentCanonicalPathEffect({
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
          const groupPath = yield* makePathEffect([
            publicPath,
            ...groupSegments,
          ]);
          const groupKey = groupSegments.join("-");

          routes.push(
            yield* decodeAssessmentRouteEffect({
              canonicalPath: yield* makePracticeGroupPathEffect({
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

  return yield* uniqueRoutesEffect(routes);
});

export const findPublicRouteByPathEffect = Effect.fn(
  "contents.route.findByPath"
)(function* (path: string, locale: Locale, inputs: RouteInputs = {}) {
  const publicPath = yield* decodePublicPathEffect(normalizePublicPath(path));
  const routes = yield* listPublicRoutesEffect(inputs);
  const exactRoute = routes.find(
    (route) => route.locale === locale && route.publicPath === publicPath
  );

  if (exactRoute) {
    return Option.some(exactRoute);
  }

  return yield* findPublicPracticeQuestionRouteByPathEffect({
    domains: inputs.domains ?? MATERIAL_ROUTE_DOMAINS,
    locale,
    materials: inputs.materials ?? MATERIAL_SOURCES,
    publicPath,
  });
});

/**
 * Finds only canonical material/practice routes for one localized public path.
 *
 * Context routes are intentionally excluded so callers that need source-backed
 * markdown or agent content refs cannot accidentally treat curriculum or
 * assessment navigation pages like duplicate material bodies.
 */
export const findPublicContentRouteByPathEffect = Effect.fn(
  "contents.route.findContentByPath"
)(function* (path: string, locale: Locale, inputs: RouteInputs = {}) {
  const publicPath = yield* decodePublicPathEffect(normalizePublicPath(path));
  const routes = yield* listPublicContentRoutesEffect(inputs);
  const exactRoute = routes.find(
    (route) => route.locale === locale && route.publicPath === publicPath
  );

  if (exactRoute) {
    return Option.some(exactRoute);
  }

  return yield* findPublicPracticeQuestionRouteByPathEffect({
    domains: inputs.domains ?? MATERIAL_ROUTE_DOMAINS,
    locale,
    materials: inputs.materials ?? MATERIAL_SOURCES,
    publicPath,
  });
});

export const findPublicContentRouteBySourcePathEffect = Effect.fn(
  "contents.route.findContentBySourcePath"
)(function* (sourcePath: string, locale: Locale, inputs: RouteInputs = {}) {
  const normalizedSourcePath = yield* decodePublicPathEffect(
    normalizePublicPath(sourcePath)
  );
  const routes = yield* listPublicContentRoutesEffect(inputs);
  const exactRoute = routes.find(
    (route) =>
      route.locale === locale && route.sourcePath === normalizedSourcePath
  );

  if (exactRoute) {
    return Option.some(exactRoute);
  }

  return yield* findPublicPracticeQuestionRouteBySourcePathEffect({
    domains: inputs.domains ?? MATERIAL_ROUTE_DOMAINS,
    locale,
    materials: inputs.materials ?? MATERIAL_SOURCES,
    sourcePath: normalizedSourcePath,
  });
});

export const toPublicExerciseQuestionPathEffect = Effect.fn(
  "contents.route.exerciseQuestionPath"
)(function* (input: ExerciseQuestionPathInput) {
  const decoded = yield* Schema.decodeUnknown(ExerciseQuestionPathInputSchema)(
    input
  ).pipe(Effect.mapError(toInvalidSourceError));
  const materials = input.materials ?? MATERIAL_SOURCES;
  const domains = input.domains ?? MATERIAL_ROUTE_DOMAINS;
  const material = materials
    .filter(isPracticeMaterialSource)
    .find(
      (candidate) =>
        candidate.assessment === decoded.assessment &&
        candidate.domain === decoded.domain
    );

  if (!material) {
    return yield* Effect.fail(
      new MissingPublicSlugError({
        locale: decoded.locale,
        source: "practice-material",
        value: decoded.domain,
      })
    );
  }

  const group = material.groups.find(
    (candidate) =>
      candidate.exerciseType === decoded.exerciseType &&
      candidate.year === decoded.year
  );

  if (!group) {
    return yield* Effect.fail(
      new MissingPublicSlugError({
        locale: decoded.locale,
        source: "practice-activity",
        value: decoded.exerciseType,
      })
    );
  }

  return yield* makePathEffect([
    yield* lookupNamespaceSegmentEffect("exercises", decoded.locale),
    material.assessment,
    yield* lookupDomainSlugEffect(
      domains,
      "practice",
      material.domain,
      decoded.locale
    ),
    ...getPracticeActivitySegments(group, decoded.locale),
    decoded.setName,
    decoded.locale === "id"
      ? `soal-${decoded.number}`
      : `question-${decoded.number}`,
  ]);
});

function listLessonPublicRoutesEffect(
  material: LessonMaterialSource,
  domains: readonly MaterialRouteDomain[]
) {
  return Effect.gen(function* () {
    const routes: PublicContentRoute[] = [];

    for (const locale of locales) {
      const topicPath = yield* makePathEffect([
        yield* lookupNamespaceSegmentEffect("subject", locale),
        yield* lookupDomainSlugEffect(
          domains,
          "lesson",
          material.domain,
          locale
        ),
        material.routeSlugs[locale],
      ]);

      routes.push(
        yield* decodeContentRouteEffect({
          description: material.translations[locale].description,
          kind: "subject-topic",
          locale,
          materialKey: material.key,
          publicPath: topicPath,
          sitemap: false,
          sourcePath: material.assetRoot,
          title: material.translations[locale].title,
        })
      );

      for (const section of material.sections) {
        const sectionSlug = section.routeSlugs[locale];
        const sectionPath = yield* makePathEffect([topicPath, sectionSlug]);

        routes.push(
          yield* decodeContentRouteEffect({
            kind: "subject-lesson",
            locale,
            materialKey: material.key,
            parentPath: topicPath,
            publicPath: sectionPath,
            sectionKey: section.slug,
            sitemap: true,
            sourcePath: yield* makePathEffect([
              material.assetRoot,
              section.slug,
            ]),
            title: section.translations[locale].title,
          })
        );
      }
    }

    return routes;
  });
}

function listPracticePublicRoutesEffect(
  material: PracticeMaterialSource,
  domains: readonly MaterialRouteDomain[]
) {
  return Effect.gen(function* () {
    const routes: PublicContentRoute[] = [];

    for (const locale of locales) {
      for (const group of material.groups) {
        const groupPath = yield* makePracticeGroupPathEffect({
          domains,
          group,
          locale,
          material,
        });

        for (const set of group.sets) {
          const setPath = yield* makePathEffect([
            groupPath,
            set.routeSlugs[locale],
          ]);

          routes.push(
            yield* decodeContentRouteEffect({
              description: group.translations[locale].description,
              kind: "exercise-set",
              locale,
              materialKey: material.key,
              parentPath: groupPath,
              publicPath: setPath,
              sectionKey: set.slug,
              sitemap: true,
              sourcePath: yield* makePathEffect([
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
  });
}

function findPublicPracticeQuestionRouteByPathEffect({
  domains,
  locale,
  materials,
  publicPath,
}: {
  domains: readonly MaterialRouteDomain[];
  locale: Locale;
  materials: readonly MaterialSource[];
  publicPath: string;
}) {
  return Effect.gen(function* () {
    const pathSegments = publicPath.split("/").filter(Boolean);
    const namespace = yield* lookupNamespaceSegmentEffect("exercises", locale);

    if (pathSegments[0] !== namespace) {
      return Option.none<PublicContentRoute>();
    }

    for (const material of materials) {
      if (material.kind !== "practice") {
        continue;
      }

      const domainSlug = yield* lookupDomainSlugEffect(
        domains,
        "practice",
        material.domain,
        locale
      );

      if (
        pathSegments[1] !== material.assessment ||
        pathSegments[2] !== domainSlug
      ) {
        continue;
      }

      for (const group of material.groups) {
        const groupSegments = getPracticeActivitySegments(group, locale);

        if (!segmentsMatch(pathSegments.slice(3), groupSegments)) {
          continue;
        }

        for (const set of group.sets) {
          const setIndex = 3 + groupSegments.length;
          const questionIndex = setIndex + 1;
          const questionNumber = readQuestionNumber(
            pathSegments[questionIndex],
            locale
          );

          if (
            pathSegments[setIndex] !== set.routeSlugs[locale] ||
            pathSegments.length !== questionIndex + 1 ||
            questionNumber === null
          ) {
            continue;
          }

          const setPath = yield* makePathEffect([
            namespace,
            material.assessment,
            domainSlug,
            ...groupSegments,
            set.routeSlugs[locale],
          ]);
          const questionPath = yield* makePathEffect([
            setPath,
            pathSegments[questionIndex],
          ]);
          const sourcePath = yield* makePathEffect([
            material.assetRoot,
            getPracticeSourceGroupSlug(group),
            set.slug,
            `question-${questionNumber}`,
          ]);

          return Option.some(
            yield* decodeContentRouteEffect({
              description: group.translations[locale].description,
              kind: "exercise-question",
              locale,
              materialKey: material.key,
              parentPath: setPath,
              publicPath: questionPath,
              sectionKey: `question-${questionNumber}`,
              sitemap: true,
              sourcePath,
              title:
                locale === "id"
                  ? `${set.translations[locale].title} Soal ${questionNumber}`
                  : `${set.translations[locale].title} Question ${questionNumber}`,
            })
          );
        }
      }
    }

    return Option.none<PublicContentRoute>();
  });
}

function findPublicPracticeQuestionRouteBySourcePathEffect({
  domains,
  locale,
  materials,
  sourcePath,
}: {
  domains: readonly MaterialRouteDomain[];
  locale: Locale;
  materials: readonly MaterialSource[];
  sourcePath: string;
}) {
  return Effect.gen(function* () {
    for (const material of materials) {
      if (material.kind !== "practice") {
        continue;
      }

      if (!sourcePath.startsWith(`${material.assetRoot}/`)) {
        continue;
      }

      const pathSegments = sourcePath
        .slice(material.assetRoot.length + 1)
        .split("/")
        .filter(Boolean);

      for (const group of material.groups) {
        if (pathSegments[0] !== getPracticeSourceGroupSlug(group)) {
          continue;
        }

        for (const set of group.sets) {
          const questionNumber = readQuestionNumber(pathSegments[2], "en");

          if (
            pathSegments[1] !== set.slug ||
            pathSegments.length !== 3 ||
            questionNumber === null
          ) {
            continue;
          }

          const setPath = yield* makePathEffect([
            yield* lookupNamespaceSegmentEffect("exercises", locale),
            material.assessment,
            yield* lookupDomainSlugEffect(
              domains,
              "practice",
              material.domain,
              locale
            ),
            ...getPracticeActivitySegments(group, locale),
            set.routeSlugs[locale],
          ]);
          const publicPath = yield* makePathEffect([
            setPath,
            locale === "id"
              ? `soal-${questionNumber}`
              : `question-${questionNumber}`,
          ]);

          return Option.some(
            yield* decodeContentRouteEffect({
              description: group.translations[locale].description,
              kind: "exercise-question",
              locale,
              materialKey: material.key,
              parentPath: setPath,
              publicPath,
              sectionKey: pathSegments[2],
              sitemap: true,
              sourcePath,
              title:
                locale === "id"
                  ? `${set.translations[locale].title} Soal ${questionNumber}`
                  : `${set.translations[locale].title} Question ${questionNumber}`,
            })
          );
        }
      }
    }

    return Option.none<PublicContentRoute>();
  });
}

function createTopicRouteByMaterialKeyEffect({
  domains,
  materials,
}: {
  domains: readonly MaterialRouteDomain[];
  materials: readonly MaterialSource[];
}) {
  return Effect.gen(function* () {
    const routes = yield* listPublicContentRoutesEffect({ domains, materials });
    const topicRouteByMaterialKey = new Map<string, PublicContentRoute>();

    for (const route of routes) {
      if (route.kind !== "subject-topic") {
        continue;
      }

      topicRouteByMaterialKey.set(
        `${route.locale}:${route.materialKey}`,
        route
      );
    }

    return topicRouteByMaterialKey;
  });
}

function createCurriculumNodeMap(nodes: readonly ProjectedCurriculumNode[]) {
  return new Map(nodes.map((node) => [getCurriculumNodeMapKey(node), node]));
}

function createDescendantMaterialMap(
  nodes: readonly ProjectedCurriculumNode[]
) {
  const nodeByKey = createCurriculumNodeMap(nodes);
  const descendantMaterials = new Map<string, Set<string>>();

  for (const node of nodes) {
    const materialKeys =
      descendantMaterials.get(getCurriculumNodeMapKey(node)) ??
      new Set<string>();

    for (const materialKey of node.materialKeys) {
      materialKeys.add(materialKey);
    }

    descendantMaterials.set(getCurriculumNodeMapKey(node), materialKeys);

    let current = node.parentKey
      ? nodeByKey.get(`${node.curriculumKey}:${node.parentKey}`)
      : undefined;

    while (current) {
      const key = getCurriculumNodeMapKey(current);
      const ancestorMaterialKeys =
        descendantMaterials.get(key) ?? new Set<string>();

      for (const materialKey of node.materialKeys) {
        ancestorMaterialKeys.add(materialKey);
      }

      descendantMaterials.set(key, ancestorMaterialKeys);
      current = current.parentKey
        ? nodeByKey.get(`${current.curriculumKey}:${current.parentKey}`)
        : undefined;
    }
  }

  return descendantMaterials;
}

function hasCurriculumMaterialDescendant(
  curriculum: CurriculumSource,
  descendantMaterials: ReadonlyMap<string, ReadonlySet<string>>
) {
  return [...descendantMaterials.entries()].some(
    ([key, materialKeys]) =>
      key.startsWith(`${curriculum.programKey}:`) && materialKeys.size > 0
  );
}

function getCurriculumNodePathSegmentsEffect({
  contentRouteByMaterialKey,
  locale,
  node,
  nodeByKey,
}: {
  contentRouteByMaterialKey: ReadonlyMap<string, PublicContentRoute>;
  locale: Locale;
  node: ProjectedCurriculumNode;
  nodeByKey: ReadonlyMap<string, ProjectedCurriculumNode>;
}) {
  return Effect.gen(function* () {
    const nodes: ProjectedCurriculumNode[] = [];
    let current: ProjectedCurriculumNode | undefined = node;

    while (current) {
      nodes.unshift(current);
      current = current.parentKey
        ? nodeByKey.get(`${current.curriculumKey}:${current.parentKey}`)
        : undefined;
    }

    const segments: PublicRouteSegment[] = [];

    for (const item of nodes) {
      const materialKey = item.materialKeys.at(0);
      const materialRoute = materialKey
        ? contentRouteByMaterialKey.get(`${locale}:${materialKey}`)
        : undefined;

      if (materialRoute) {
        segments.push(yield* lastPathSegmentEffect(materialRoute.publicPath));
        continue;
      }

      segments.push(item.translations[locale].routeSlug);
    }

    return segments;
  });
}

function createPracticeMaterialByKey(materials: readonly MaterialSource[]) {
  const entries: [PracticeMaterialSource["key"], PracticeMaterialSource][] = [];

  for (const material of materials) {
    if (material.kind === "practice") {
      entries.push([material.key, material]);
    }
  }

  return new Map(entries);
}

function hasAssessmentMaterialChild(
  nodeKey: string,
  assessment: AssessmentSource
) {
  return assessment.nodes.some(
    (node) => node.parentKey === nodeKey && node.materialKeys.length > 0
  );
}

function getAssessmentNodePathSegmentsEffect({
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

function getAssessmentCanonicalPathEffect({
  domains,
  locale,
  materialKey,
  practiceMaterialByKey,
}: {
  domains: readonly MaterialRouteDomain[];
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

    return yield* makePracticeGroupPathEffect({
      domains,
      group,
      locale,
      material,
    });
  });
}

function makeAssessmentProgramPathEffect(
  program: LearningProgram,
  locale: Locale
) {
  return Effect.gen(function* () {
    return yield* makePathEffect([
      yield* lookupNamespaceSegmentEffect("assessment", locale),
      program.translations[locale].publicSlug,
    ]);
  });
}

function makePracticeGroupPathEffect({
  domains,
  group,
  locale,
  material,
}: {
  domains: readonly MaterialRouteDomain[];
  group: PracticeMaterialGroup;
  locale: Locale;
  material: Pick<PracticeMaterialSource, "assessment" | "domain">;
}) {
  return Effect.gen(function* () {
    return yield* makePathEffect([
      yield* lookupNamespaceSegmentEffect("exercises", locale),
      material.assessment,
      yield* lookupDomainSlugEffect(
        domains,
        "practice",
        material.domain,
        locale
      ),
      ...getPracticeActivitySegments(group, locale),
    ]);
  });
}

function findProgramEffect(
  programs: readonly LearningProgram[],
  programKey: LearningProgramKey
) {
  return Effect.gen(function* () {
    const program = programs.find((candidate) => candidate.key === programKey);

    if (!program) {
      return yield* Effect.fail(
        new MissingPublicSlugError({
          locale: "en",
          source: "program",
          value: programKey,
        })
      );
    }

    return program;
  });
}

function lookupNamespaceSegmentEffect(
  namespace: PublicRouteSurfaceKey,
  locale: Locale
) {
  return Effect.gen(function* () {
    const surface = PUBLIC_ROUTE_SURFACES.find(
      (item) => item.key === namespace
    );

    if (!surface) {
      return yield* Effect.fail(
        new MissingPublicSlugError({
          locale,
          source: "route-surface",
          value: namespace,
        })
      );
    }

    return surface.routeSlugs[locale];
  });
}

function lookupDomainSlugEffect(
  domains: readonly MaterialRouteDomain[],
  kind: MaterialRouteDomain["kind"],
  domain: MaterialRouteDomain["domain"],
  locale: Locale
) {
  return Effect.gen(function* () {
    const row = domains.find(
      (candidate) => candidate.kind === kind && candidate.domain === domain
    );

    if (!row) {
      return yield* Effect.fail(
        new MissingPublicSlugError({
          locale,
          source: `${kind}-domain`,
          value: domain,
        })
      );
    }

    return row.routeSlugs[locale];
  });
}

function getPracticeActivitySegments(
  group: Pick<PracticeMaterialGroup, "routeSlugs" | "year">,
  locale: Locale
) {
  if (group.year === undefined) {
    return [group.routeSlugs[locale]];
  }

  return [group.routeSlugs[locale], group.year.toString()];
}

function segmentsMatch(actual: readonly string[], expected: readonly string[]) {
  return expected.every((segment, index) => actual[index] === segment);
}

function readQuestionNumber(segment: string | undefined, locale: Locale) {
  if (!segment) {
    return null;
  }

  const prefix = locale === "id" ? "soal-" : "question-";

  if (!segment.startsWith(prefix)) {
    return null;
  }

  const value = Number.parseInt(segment.slice(prefix.length), 10);

  return Number.isInteger(value) && value > 0 ? value : null;
}

function getPracticeSourceGroupSlug(group: PracticeMaterialGroup) {
  return group.year === undefined
    ? group.exerciseType
    : `${group.exerciseType}-${group.year}`;
}

function decodeContentRouteEffect(
  input: Schema.Schema.Encoded<typeof PublicContentRouteSchema>
) {
  return Schema.decodeUnknown(PublicContentRouteSchema)(input).pipe(
    Effect.mapError(toInvalidSourceError)
  );
}

function decodeCurriculumRouteEffect(
  input: Schema.Schema.Encoded<typeof PublicCurriculumRouteSchema>
) {
  return Schema.decodeUnknown(PublicCurriculumRouteSchema)(input).pipe(
    Effect.mapError(toInvalidSourceError)
  );
}

function decodeAssessmentRouteEffect(
  input: Schema.Schema.Encoded<typeof PublicAssessmentRouteSchema>
) {
  return Schema.decodeUnknown(PublicAssessmentRouteSchema)(input).pipe(
    Effect.mapError(toInvalidSourceError)
  );
}

function decodePublicPathEffect(path: string) {
  return Schema.decodeUnknown(PublicRoutePathSchema)(path).pipe(
    Effect.mapError(toInvalidSourceError)
  );
}

function makePathEffect(segments: readonly (string | undefined)[]) {
  return decodePublicPathEffect(joinRouteSegments(segments));
}

function lastPathSegmentEffect(path: string) {
  const segments = path.split("/").filter(Boolean);
  const segment = segments.at(-1);

  return Schema.decodeUnknown(PublicRouteSegmentSchema)(segment).pipe(
    Effect.mapError(toInvalidSourceError)
  );
}

function uniqueRoutesEffect<TRoute extends PublicRoute>(
  routes: readonly TRoute[]
) {
  return Effect.gen(function* () {
    const byPath = new Map<string, TRoute>();

    for (const route of routes) {
      const key = `${route.locale}:${route.publicPath}`;
      const existing = byPath.get(key);

      if (existing) {
        return yield* Effect.fail(
          new DuplicatePublicRouteError({
            duplicateKind: route.kind,
            existingKind: existing.kind,
            locale: route.locale,
            publicPath: route.publicPath,
          })
        );
      }

      byPath.set(key, route);
    }

    return [...byPath.values()].sort((left, right) =>
      left.publicPath.localeCompare(right.publicPath)
    );
  });
}

function normalizePublicPath(path: string) {
  return path.split("/").filter(Boolean).join("/");
}

function joinRouteSegments(segments: readonly (string | undefined)[]) {
  return segments.filter((segment) => segment && segment.length > 0).join("/");
}

function getParentPath(path: string) {
  return path.split("/").slice(0, -1).join("/");
}

function getCurriculumNodeMapKey(node: ProjectedCurriculumNode) {
  return `${node.curriculumKey}:${node.key}`;
}

function toInvalidSourceError(error: unknown) {
  return new InvalidPublicRouteSourceError({
    message: String(error),
  });
}
