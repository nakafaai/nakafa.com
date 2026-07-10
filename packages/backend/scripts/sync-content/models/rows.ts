import { join } from "node:path";
import type { internal } from "@repo/backend/convex/_generated/api";
import {
  parseDateToEpoch,
  readMdxFile,
} from "@repo/backend/scripts/lib/mdx-parser/content";
import type { SyncOptions } from "@repo/backend/scripts/sync-content/contract/types";
import { CONTENTS_DIR } from "@repo/backend/scripts/sync-content/runtime/paths";
import { listAssessments } from "@repo/contents/_types/assessment/registry";
import { projectCurriculumNodes } from "@repo/contents/_types/curriculum/projection";
import { listCurricula } from "@repo/contents/_types/curriculum/registry";
import {
  listLessonMaterialSources,
  listMaterials,
} from "@repo/contents/_types/material/registry";
import type { MaterialLocale } from "@repo/contents/_types/material/schema";
import { findLearningProgramByKey } from "@repo/contents/_types/program/catalog";
import type { LearningProgram } from "@repo/contents/_types/program/schema";
import { listPublicRoutes } from "@repo/contents/_types/route/projection";
import type { PublicRoute } from "@repo/contents/_types/route/schema";
import type { FunctionArgs } from "convex/server";
import { Effect } from "effect";

type MaterialPayload = FunctionArgs<
  typeof internal.contentSync.mutations.readModels.materials.bulkSyncMaterials
>["materials"][number];

type MaterialLocalePayload = FunctionArgs<
  typeof internal.contentSync.mutations.readModels.materials.bulkSyncMaterialLocales
>["locales"][number];

type GeneratedProgramPayload = FunctionArgs<
  typeof internal.contentSync.mutations.readModels.curricula.bulkSyncCurricula
>["curricula"][number];

type CurriculumNodePayload = FunctionArgs<
  typeof internal.contentSync.mutations.readModels.curricula.bulkSyncCurriculumNodes
>["nodes"][number];

type CurriculumMaterialPayload = FunctionArgs<
  typeof internal.contentSync.mutations.readModels.curricula.bulkSyncCurriculumMaterials
>["mappings"][number];

type AssessmentNodePayload = FunctionArgs<
  typeof internal.contentSync.mutations.readModels.assessments.bulkSyncAssessmentNodes
>["nodes"][number];

type PublicRoutePayload = FunctionArgs<
  typeof internal.contentSync.mutations.readModels.routes.bulkSyncPublicRoutes
>["routes"][number];

const MATERIAL_LOCALES: readonly MaterialLocale[] = ["en", "id"];

/**
 * Builds stable material catalog rows from the content source registry.
 *
 * The sync mutation is responsible for persistence; this function owns only the
 * source-to-Convex payload shape so material identity stays derived from
 * `packages/contents` instead of script-local URL conventions.
 */
export function readMaterialRows() {
  return listMaterials().map(
    (material): MaterialPayload => ({
      concepts: [],
      domain: material.domain,
      key: material.key,
      kind: material.kind,
      route: material.assetRoot,
    })
  );
}

/**
 * Builds localized material rows for lesson MDX.
 *
 * Rows read MDX through the existing parser effect so parse/date failures
 * remain in the Effect channel.
 */
export const readMaterialLocaleRows = Effect.fn("sync.readMaterialLocaleRows")(
  function* (options: SyncOptions) {
    return yield* readLessonMaterialLocaleRows(options);
  }
);

/**
 * Builds curriculum, node, and material mapping rows from curriculum sources.
 *
 * The order and material relationships are projected by the curriculum module;
 * the sync script only forwards the resulting rows to Convex.
 */
export const readCurriculumRows = Effect.fn("sync.readCurriculumRows")(
  function* () {
    const curricula = listCurricula();
    const curriculumNodes = yield* projectCurriculumNodes({ curricula });
    const curriculumRows = curricula.flatMap((curriculum) => {
      const program = findLearningProgramByKey(curriculum.programKey);
      return program ? [toGeneratedProgramRow(program)] : [];
    });
    const nodeRows: CurriculumNodePayload[] = curriculumNodes.map((node) => ({
      curriculumKey: node.curriculumKey,
      displayOrder: node.order,
      key: node.key,
      level: node.level,
      parentKey: node.parentKey,
      translations: node.translations,
    }));
    const materialRows: CurriculumMaterialPayload[] = curriculumNodes.flatMap(
      (node) =>
        node.materialKeys.map((materialKey, index) => ({
          curriculumKey: node.curriculumKey,
          materialKey,
          nodeKey: node.key,
          order: index,
        }))
    );

    return { curriculumRows, materialRows, nodeRows };
  }
);

/**
 * Builds assessment catalog and node rows from assessment source modules.
 *
 * Assessment program labels reuse the same program row shape as curricula while
 * assessment nodes keep their own material-key arrays for route context
 * context lookups.
 */
export function readAssessmentRows() {
  const assessments = listAssessments();
  const assessmentRows = assessments.flatMap((assessment) => {
    const program = findLearningProgramByKey(assessment.programKey);
    return program ? [toGeneratedProgramRow(program)] : [];
  });
  const nodeRows: AssessmentNodePayload[] = assessments.flatMap((assessment) =>
    assessment.nodes.map((node) => ({
      assessmentKey: assessment.programKey,
      displayOrder: node.order,
      key: node.key,
      level: node.level,
      materialKeys: [...node.materialKeys],
      parentKey: node.parentKey,
      translations: node.translations,
    }))
  );

  return { assessmentRows, nodeRows };
}

/**
 * Builds Convex public route rows from the contents route projection.
 *
 * This keeps Convex route read models aligned with the same source-owned
 * projection used by app routes, sitemap, LLMS, and assistant context.
 */
export const readPublicRouteRows = Effect.fn("sync.readPublicRouteRows")(
  function* () {
    const routes = yield* listPublicRoutes();
    return routes.map(toPublicRoutePayload);
  }
);

/** Reads lesson MDX metadata into stable locale rows without duplicating body content. */
const readLessonMaterialLocaleRows = Effect.fn(
  "sync.readLessonMaterialLocaleRows"
)(function* (options: SyncOptions) {
  const rows: MaterialLocalePayload[] = [];
  const locales = getLocales(options);

  for (const material of listLessonMaterialSources()) {
    for (const locale of locales) {
      for (const section of material.sections) {
        const route = `${material.assetRoot}/${section.slug}`;
        const mdx = yield* readMdxFile(getMaterialMdxPath(route, locale));
        const date = yield* parseDateToEpoch(mdx.metadata.date);

        rows.push({
          body: mdx.body,
          contentHash: mdx.contentHash,
          date,
          locale,
          materialKey: material.key,
          metadata: {
            description: mdx.metadata.description,
            title: mdx.metadata.title,
          },
          route,
          sectionKey: section.slug,
        });
      }
    }
  }

  return rows;
});

/** Resolves one localized lesson MDX file from its source asset route. */
function getMaterialMdxPath(route: string, locale: MaterialLocale) {
  return join(CONTENTS_DIR, route, `${locale}.mdx`);
}

/** Applies the sync locale option while defaulting to all material locales. */
function getLocales(options: SyncOptions): readonly MaterialLocale[] {
  return options.locale === undefined ? MATERIAL_LOCALES : [options.locale];
}

/** Converts one learning program source row into a generated Convex program row. */
function toGeneratedProgramRow(
  program: LearningProgram
): GeneratedProgramPayload {
  return {
    defaultCoverageStatus: program.defaultCoverageStatus,
    displayOrder: program.displayOrder,
    key: program.key,
    kind: program.kind,
    navigation: {
      levels: [...program.navigation.levels],
      model: program.navigation.model,
    },
    providerHomeCountry: program.provider.homeCountry,
    providerKind: program.provider.kind,
    providerName: program.provider.name,
    recommendedCountry: program.recommendedCountry,
    sources: program.sources.map((source) => ({
      label: source.label,
      retrievedAt: source.retrievedAt,
      reviewAfter: source.reviewAfter,
      type: source.type,
      url: source.url,
    })),
    translations: {
      en: { ...program.translations.en },
      id: { ...program.translations.id },
    },
    versionEndsAt: program.version.endsAt,
    versionLabel: program.version.label,
    versionStartsAt: program.version.startsAt,
  };
}

/**
 * Converts one source-owned route projection into the Convex route read model.
 *
 * Optional fields stay absent for route kinds that do not own that dimension:
 * content rows own `sourcePath`, context rows own `programKey`/`nodeKey`, and
 * material-backed rows expose `materialKey` for reverse lookup.
 */
function toPublicRoutePayload(route: PublicRoute): PublicRoutePayload {
  return {
    canonicalPath: "canonicalPath" in route ? route.canonicalPath : undefined,
    description: "description" in route ? route.description : undefined,
    displayGroupIconKey:
      "displayGroupIconKey" in route ? route.displayGroupIconKey : undefined,
    displayGroupTitle:
      "displayGroupTitle" in route ? route.displayGroupTitle : undefined,
    iconKey: "iconKey" in route ? route.iconKey : undefined,
    kind: route.kind,
    level: "level" in route ? route.level : undefined,
    locale: route.locale,
    materialCardDescription:
      "materialCardDescription" in route
        ? route.materialCardDescription
        : undefined,
    materialCardTitle:
      "materialCardTitle" in route ? route.materialCardTitle : undefined,
    materialDomain:
      "materialDomain" in route ? route.materialDomain : undefined,
    materialKey: "materialKey" in route ? route.materialKey : undefined,
    nodeKey: "nodeKey" in route ? route.nodeKey : undefined,
    order: "order" in route ? route.order : undefined,
    parentPath: "parentPath" in route ? route.parentPath : undefined,
    programKey: "programKey" in route ? route.programKey : undefined,
    publicPath: route.publicPath,
    sectionKey: "sectionKey" in route ? route.sectionKey : undefined,
    sitemap: route.sitemap,
    sourcePath: "sourcePath" in route ? route.sourcePath : undefined,
    title: route.title,
  };
}
