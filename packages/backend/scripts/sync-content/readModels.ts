import { join } from "node:path";
import { internal } from "@repo/backend/convex/_generated/api";
import {
  computeHash,
  parseDateToEpoch,
  readMdxFile,
} from "@repo/backend/scripts/lib/mdx-parser/content";
import { callConvexMutation } from "@repo/backend/scripts/sync-content/convex";
import {
  formatDuration,
  log,
  logSuccess,
} from "@repo/backend/scripts/sync-content/logging";
import {
  createBatchProgress,
  formatBatchProgress,
  updateBatchProgress,
} from "@repo/backend/scripts/sync-content/metrics";
import { CONTENTS_DIR } from "@repo/backend/scripts/sync-content/paths";
import {
  BATCH_SIZES,
  GeneratedReadModelDeleteResultSchema,
  GeneratedReadModelSyncResultSchema,
} from "@repo/backend/scripts/sync-content/schemas";
import type {
  ConvexConfig,
  SyncOptions,
  SyncResult,
} from "@repo/backend/scripts/sync-content/types";
import { listAssessments } from "@repo/contents/_types/assessment/registry";
import { listCurriculumNodesEffect } from "@repo/contents/_types/curriculum/projection";
import { listCurricula } from "@repo/contents/_types/curriculum/registry";
import {
  listLessonMaterialSources,
  listMaterials,
  listPracticeMaterialSources,
} from "@repo/contents/_types/material/registry";
import type { MaterialLocale } from "@repo/contents/_types/material/schema";
import { findLearningProgramByKey } from "@repo/contents/_types/program/catalog";
import type { LearningProgram } from "@repo/contents/_types/program/schema";
import { listPublicRoutesEffect } from "@repo/contents/_types/route/projection";
import type { PublicRoute } from "@repo/contents/_types/route/schema";
import type {
  DefaultFunctionArgs,
  FunctionArgs,
  FunctionReference,
} from "convex/server";
import { Effect } from "effect";

type MaterialPayload = FunctionArgs<
  typeof internal.contentSync.mutations.readModels.bulkSyncMaterials
>["materials"][number];

type MaterialLocalePayload = FunctionArgs<
  typeof internal.contentSync.mutations.readModels.bulkSyncMaterialLocales
>["locales"][number];

type GeneratedProgramPayload = FunctionArgs<
  typeof internal.contentSync.mutations.readModels.bulkSyncCurricula
>["curricula"][number];

type CurriculumNodePayload = FunctionArgs<
  typeof internal.contentSync.mutations.readModels.bulkSyncCurriculumNodes
>["nodes"][number];

type CurriculumMaterialPayload = FunctionArgs<
  typeof internal.contentSync.mutations.readModels.bulkSyncCurriculumMaterials
>["mappings"][number];

type AssessmentNodePayload = FunctionArgs<
  typeof internal.contentSync.mutations.readModels.bulkSyncAssessmentNodes
>["nodes"][number];

type PublicRoutePayload = FunctionArgs<
  typeof internal.contentSync.mutations.readModels.bulkSyncPublicRoutes
>["routes"][number];

type SyncMutation = FunctionReference<
  "mutation",
  "internal",
  DefaultFunctionArgs,
  SyncResult
>;

type DeleteMutation = FunctionReference<
  "mutation",
  "internal",
  DefaultFunctionArgs,
  { deleted: number }
>;

const MATERIAL_LOCALES: readonly MaterialLocale[] = ["en", "id"];

/** Syncs final generated material, curriculum, and assessment read models. */
export const syncGeneratedReadModels = Effect.fn("sync.generatedReadModels")(
  function* (config: ConvexConfig, options: SyncOptions) {
    const startTime = performance.now();
    const syncedAt = Date.now();

    if (!options.quiet) {
      log("\n--- GENERATED READ MODELS ---\n");
    }

    const materialResult = yield* syncMaterials(config, syncedAt, options);
    const materialLocaleResult = yield* syncMaterialLocales(
      config,
      syncedAt,
      options
    );
    const curriculumResult = yield* syncCurricula(config, syncedAt, options);
    const assessmentResult = yield* syncAssessments(config, syncedAt, options);
    const publicRouteResult = yield* syncPublicRoutes(
      config,
      syncedAt,
      options
    );
    const deleted = yield* deleteStaleGeneratedReadModels(
      config,
      syncedAt,
      options
    );

    const result = combineSyncResults([
      materialResult,
      materialLocaleResult,
      curriculumResult,
      assessmentResult,
      publicRouteResult,
    ]);
    const processed = result.created + result.updated + result.unchanged;
    const durationMs = performance.now() - startTime;
    const itemsPerSecond = durationMs > 0 ? (processed / durationMs) * 1000 : 0;

    if (!options.quiet) {
      log(
        `\nResult: ${result.created} created, ${result.updated} updated, ${result.unchanged} unchanged`
      );
      log(`Deleted stale generated rows: ${deleted}`);
      log(
        `Time: ${formatDuration(durationMs)} (${itemsPerSecond.toFixed(1)} items/sec)`
      );
      logSuccess(`${processed} generated read model rows synced`);
    }

    return { ...result, durationMs, itemsPerSecond };
  }
);

const syncMaterials = Effect.fn("sync.generatedMaterials")(function* (
  config: ConvexConfig,
  syncedAt: number,
  options: SyncOptions
) {
  const rows: MaterialPayload[] = listMaterials().map((material) => ({
    concepts: [],
    domain: material.domain,
    key: material.key,
    kind: material.kind,
    route: material.assetRoot,
  }));

  return yield* syncBatches({
    batchSize: BATCH_SIZES.generatedMaterials,
    config,
    label: "Materials",
    mutation: internal.contentSync.mutations.readModels.bulkSyncMaterials,
    options,
    rows,
    toArgs: (batch) => ({ materials: batch, syncedAt }),
  });
});

const syncMaterialLocales = Effect.fn("sync.generatedMaterialLocales")(
  function* (config: ConvexConfig, syncedAt: number, options: SyncOptions) {
    const lessonRows = yield* readLessonMaterialLocaleRows(options);
    const practiceRows = readPracticeMaterialLocaleRows(options);
    const rows = [...lessonRows, ...practiceRows];

    return yield* syncBatches({
      batchSize: BATCH_SIZES.generatedMaterialLocales,
      config,
      label: "Material Locales",
      mutation:
        internal.contentSync.mutations.readModels.bulkSyncMaterialLocales,
      options,
      rows,
      toArgs: (batch) => ({ locales: batch, syncedAt }),
    });
  }
);

const syncCurricula = Effect.fn("sync.generatedCurricula")(function* (
  config: ConvexConfig,
  syncedAt: number,
  options: SyncOptions
) {
  const curricula = listCurricula();
  const curriculumNodes = yield* listCurriculumNodesEffect({ curricula });
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

  return yield* Effect.gen(function* () {
    const curriculumResult = yield* syncBatches({
      batchSize: BATCH_SIZES.generatedCurricula,
      config,
      label: "Curricula",
      mutation: internal.contentSync.mutations.readModels.bulkSyncCurricula,
      options,
      rows: curriculumRows,
      toArgs: (batch) => ({ curricula: batch, syncedAt }),
    });
    const nodeResult = yield* syncBatches({
      batchSize: BATCH_SIZES.generatedCurriculumNodes,
      config,
      label: "Curriculum Nodes",
      mutation:
        internal.contentSync.mutations.readModels.bulkSyncCurriculumNodes,
      options,
      rows: nodeRows,
      toArgs: (batch) => ({ nodes: batch, syncedAt }),
    });
    const materialResult = yield* syncBatches({
      batchSize: BATCH_SIZES.generatedCurriculumMaterials,
      config,
      label: "Curriculum Materials",
      mutation:
        internal.contentSync.mutations.readModels.bulkSyncCurriculumMaterials,
      options,
      rows: materialRows,
      toArgs: (batch) => ({ mappings: batch, syncedAt }),
    });

    return combineSyncResults([curriculumResult, nodeResult, materialResult]);
  });
});

const syncAssessments = Effect.fn("sync.generatedAssessments")(function* (
  config: ConvexConfig,
  syncedAt: number,
  options: SyncOptions
) {
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

  return yield* Effect.gen(function* () {
    const assessmentResult = yield* syncBatches({
      batchSize: BATCH_SIZES.generatedAssessments,
      config,
      label: "Assessments",
      mutation: internal.contentSync.mutations.readModels.bulkSyncAssessments,
      options,
      rows: assessmentRows,
      toArgs: (batch) => ({ assessments: batch, syncedAt }),
    });
    const nodeResult = yield* syncBatches({
      batchSize: BATCH_SIZES.generatedAssessmentNodes,
      config,
      label: "Assessment Nodes",
      mutation:
        internal.contentSync.mutations.readModels.bulkSyncAssessmentNodes,
      options,
      rows: nodeRows,
      toArgs: (batch) => ({ nodes: batch, syncedAt }),
    });

    return combineSyncResults([assessmentResult, nodeResult]);
  });
});

const syncPublicRoutes = Effect.fn("sync.generatedPublicRoutes")(function* (
  config: ConvexConfig,
  syncedAt: number,
  options: SyncOptions
) {
  const routes = yield* listPublicRoutesEffect();
  const rows = routes.map(toPublicRoutePayload);

  return yield* syncBatches({
    batchSize: BATCH_SIZES.generatedPublicRoutes,
    config,
    label: "Public Routes",
    mutation: internal.contentSync.mutations.readModels.bulkSyncPublicRoutes,
    options,
    rows,
    toArgs: (batch) => ({ routes: batch, syncedAt }),
  });
});

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

function getMaterialMdxPath(route: string, locale: MaterialLocale) {
  return join(CONTENTS_DIR, route, `${locale}.mdx`);
}

function readPracticeMaterialLocaleRows(options: SyncOptions) {
  const rows: MaterialLocalePayload[] = [];
  const locales = getLocales(options);

  for (const material of listPracticeMaterialSources()) {
    for (const locale of locales) {
      for (const group of material.groups) {
        const groupRoute = getPracticeGroupRoute(material.assetRoot, group);

        for (const set of group.sets) {
          const route = `${groupRoute}/${set.slug}`;
          rows.push({
            contentHash: computeHash(
              JSON.stringify({
                locale,
                materialKey: material.key,
                route,
                title: set.translations[locale].title,
              })
            ),
            locale,
            materialKey: material.key,
            metadata: {
              description: group.translations[locale].description,
              title: set.translations[locale].title,
            },
            route,
            sectionKey: route,
          });
        }
      }
    }
  }

  return rows;
}

function getPracticeGroupRoute(
  assetRoot: string,
  group: ReturnType<
    typeof listPracticeMaterialSources
  >[number]["groups"][number]
) {
  const exerciseType =
    group.year === undefined
      ? group.exerciseType
      : `${group.exerciseType}-${group.year}`;

  return `${assetRoot}/${exerciseType}`;
}

function getLocales(options: SyncOptions): readonly MaterialLocale[] {
  return options.locale === undefined ? MATERIAL_LOCALES : [options.locale];
}

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
    providerCountry: program.provider.country,
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
    description: route.description,
    kind: route.kind,
    locale: route.locale,
    materialDomain:
      "materialDomain" in route ? route.materialDomain : undefined,
    materialKey: "materialKey" in route ? route.materialKey : undefined,
    nodeKey: "nodeKey" in route ? route.nodeKey : undefined,
    parentPath: route.parentPath,
    programKey: "programKey" in route ? route.programKey : undefined,
    publicPath: route.publicPath,
    sectionKey: "sectionKey" in route ? route.sectionKey : undefined,
    sitemap: route.sitemap,
    sourcePath: "sourcePath" in route ? route.sourcePath : undefined,
    title: route.title,
  };
}

function combineSyncResults(results: readonly SyncResult[]): SyncResult {
  return results.reduce(
    (total, result) => ({
      created: total.created + result.created,
      unchanged: total.unchanged + result.unchanged,
      updated: total.updated + result.updated,
    }),
    { created: 0, unchanged: 0, updated: 0 }
  );
}

function syncBatches<Row, TFunction extends SyncMutation>({
  batchSize,
  config,
  label,
  mutation,
  options,
  rows,
  toArgs,
}: {
  batchSize: number;
  config: ConvexConfig;
  label: string;
  mutation: TFunction;
  options: SyncOptions;
  rows: readonly Row[];
  toArgs: (batch: Row[]) => FunctionArgs<TFunction>;
}) {
  return Effect.gen(function* () {
    const totals: SyncResult = { created: 0, unchanged: 0, updated: 0 };
    const totalBatches = Math.ceil(rows.length / batchSize);
    const progress = createBatchProgress(rows.length, batchSize);

    for (let index = 0; index < rows.length; index += batchSize) {
      const batch = rows.slice(index, index + batchSize);
      const batchNum = Math.floor(index / batchSize) + 1;

      if (!options.quiet) {
        log(
          formatBatchProgress(progress, batchNum, totalBatches, batch.length)
        );
      }

      const result = yield* callConvexMutation(
        config,
        mutation,
        toArgs(batch),
        GeneratedReadModelSyncResultSchema
      );

      totals.created += result.created;
      totals.updated += result.updated;
      totals.unchanged += result.unchanged;
      updateBatchProgress(progress, batch.length);
    }

    if (!options.quiet) {
      log(`  ${label}: ${totals.created} new, ${totals.updated} updated`);
    }

    return totals;
  });
}

const deleteStaleGeneratedReadModels = Effect.fn(
  "sync.deleteStaleGeneratedReadModels"
)(function* (config: ConvexConfig, syncedAt: number, options: SyncOptions) {
  const deleted =
    (yield* deleteAllStaleRows(
      config,
      internal.contentSync.mutations.readModels.deleteStaleMaterialLocales,
      {
        limit: BATCH_SIZES.generatedMaterialLocales,
        locale: options.locale,
        syncedAt,
      }
    )) +
    (yield* deleteAllStaleRows(
      config,
      internal.contentSync.mutations.readModels.deleteStaleMaterials,
      { limit: BATCH_SIZES.generatedMaterials, syncedAt }
    )) +
    (yield* deleteAllStaleRows(
      config,
      internal.contentSync.mutations.readModels.deleteStaleCurriculumMaterials,
      { limit: BATCH_SIZES.generatedCurriculumMaterials, syncedAt }
    )) +
    (yield* deleteAllStaleRows(
      config,
      internal.contentSync.mutations.readModels.deleteStaleCurriculumNodes,
      { limit: BATCH_SIZES.generatedCurriculumNodes, syncedAt }
    )) +
    (yield* deleteAllStaleRows(
      config,
      internal.contentSync.mutations.readModels.deleteStaleCurricula,
      { limit: BATCH_SIZES.generatedCurricula, syncedAt }
    )) +
    (yield* deleteAllStaleRows(
      config,
      internal.contentSync.mutations.readModels.deleteStaleAssessmentNodes,
      { limit: BATCH_SIZES.generatedAssessmentNodes, syncedAt }
    )) +
    (yield* deleteAllStaleRows(
      config,
      internal.contentSync.mutations.readModels.deleteStaleAssessments,
      { limit: BATCH_SIZES.generatedAssessments, syncedAt }
    )) +
    (yield* deleteAllStaleRows(
      config,
      internal.contentSync.mutations.readModels.deleteStalePublicRoutes,
      { limit: BATCH_SIZES.generatedPublicRoutes, syncedAt }
    ));

  return deleted;
});

function deleteAllStaleRows<TFunction extends DeleteMutation>(
  config: ConvexConfig,
  mutation: TFunction,
  args: FunctionArgs<TFunction> & { limit: number }
) {
  return Effect.gen(function* () {
    let deleted = 0;

    while (true) {
      const result = yield* callConvexMutation(
        config,
        mutation,
        args,
        GeneratedReadModelDeleteResultSchema
      );

      deleted += result.deleted;

      if (result.deleted < args.limit) {
        return deleted;
      }
    }
  });
}
