import type { ActiveAppLocaleList } from "@nakafa/aksara-contracts/locale";
import { MaterialSource } from "@repo/backend/content/material/source";
import { verifyMaterial } from "@repo/backend/content/material/verify";
import { ProgramSource } from "@repo/backend/content/program/source";
import { verifyCurriculum } from "@repo/backend/content/program/verify";
import type { PublicationRow } from "@repo/backend/content/publication/source";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import type { ModelSlot } from "@repo/backend/convex/contentRelease/models/slot";
import {
  PROGRAM_ANCESTOR_LIMIT,
  PROGRAM_MATERIAL_LIMIT,
  PROGRAM_RELATED_LIMIT,
} from "@repo/backend/convex/contentRelease/program/limits";
import { Effect, Option } from "effect";

type CurriculumRoute = Effect.Success<ReturnType<typeof verifyCurriculum>>;
/** Orders material groups exactly as authored, with paths as stable tie-breakers. */
function compareGroups(
  left: PublicationRow<"curriculumRoutes">,
  right: PublicationRow<"curriculumRoutes">
) {
  const order = left.order - right.order;
  if (order !== 0) {
    return order;
  }
  return left.path.localeCompare(right.path);
}

/** Rejects a bounded relationship whose source fan-out exceeds its contract. */
const requireBoundedRows = Effect.fn("contentRelease.requireProgramRows")(
  function* <Row>(rows: readonly Row[], label: string) {
    if (rows.length > PROGRAM_RELATED_LIMIT) {
      return yield* releaseFail(
        "CONTENT_RELEASE_LIMIT",
        `${label} exceeds ${PROGRAM_RELATED_LIMIT} rows.`
      );
    }
    return rows;
  }
);
/** Reads the complete verified parent chain for one curriculum route. */
const readAncestors = Effect.fn("contentRelease.readProgramAncestors")(
  function* (snapshotId: string, route: CurriculumRoute) {
    const source = yield* ProgramSource;
    const rows: PublicationRow<"curriculumRoutes">[] = [];
    let parentPath = route.parentPath;
    while (parentPath) {
      if (rows.length === PROGRAM_ANCESTOR_LIMIT) {
        return yield* releaseFail(
          "CONTENT_RELEASE_LIMIT",
          `Curriculum route ${route.appLocale}/${route.publicPath} exceeds ${PROGRAM_ANCESTOR_LIMIT} ancestors.`
        );
      }
      const parent = yield* source
        .route(snapshotId, route.appLocale, parentPath)
        .pipe(Effect.map(Option.getOrNull));
      if (!parent) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          `Curriculum route ${route.appLocale}/${route.publicPath} lost parent ${parentPath}.`
        );
      }
      const verified = yield* verifyCurriculum(parent, snapshotId);
      rows.unshift(parent);
      parentPath = verified.parentPath;
    }
    return rows;
  }
);
/** Reads every localized counterpart through source-owned node identity. */
const readAlternates = Effect.fn("contentRelease.readProgramAlternates")(
  function* (
    snapshotId: string,
    programKey: string,
    nodeKey: string,
    activeAppLocales: ActiveAppLocaleList
  ) {
    const source = yield* ProgramSource;
    return yield* Effect.forEach(activeAppLocales, (appLocale) =>
      source.node(snapshotId, appLocale, programKey, nodeKey).pipe(
        Effect.map(Option.getOrNull),
        Effect.flatMap((row) =>
          row
            ? verifyCurriculum(row, snapshotId).pipe(Effect.as(row))
            : releaseFail(
                "CONTENT_RELEASE_INTEGRITY",
                `Curriculum node ${programKey}/${nodeKey} lost locale ${appLocale}.`
              )
        )
      )
    );
  }
);
/** Reads one indexed relationship page from an immutable program snapshot. */
const readRelatedRows = Effect.fn("contentRelease.readProgramRelations")(
  function* (
    snapshotId: string,
    route: CurriculumRoute,
    relation: "children" | "contexts"
  ) {
    const source = yield* ProgramSource;
    const rows = yield* source.related(
      snapshotId,
      route.appLocale,
      relation,
      route.publicPath,
      PROGRAM_RELATED_LIMIT + 1
    );
    return yield* requireBoundedRows(
      rows,
      `Curriculum ${relation} for ${route.appLocale}/${route.publicPath}`
    );
  }
);
/** Reads every group route referenced by material-context rows. */
const readGroups = Effect.fn("contentRelease.readProgramGroups")(function* (
  snapshotId: string,
  route: CurriculumRoute,
  contexts: readonly CurriculumRoute[]
) {
  // The exact context index and decoded route schema prove these fields exist.
  const publicPaths = new Set(
    yield* Effect.forEach(contexts, ({ materialContextPublicPath }) =>
      Effect.fromNullishOr(materialContextPublicPath).pipe(Effect.orDie)
    )
  );
  const source = yield* ProgramSource;
  const groups = yield* Effect.forEach(publicPaths, (publicPath) =>
    source.route(snapshotId, route.appLocale, publicPath).pipe(
      Effect.map(Option.getOrNull),
      Effect.flatMap((row) =>
        row
          ? verifyCurriculum(row, snapshotId).pipe(Effect.as(row))
          : releaseFail(
              "CONTENT_RELEASE_INTEGRITY",
              `Curriculum material group ${publicPath} is missing.`
            )
      )
    )
  );
  return groups.sort(compareGroups);
});
/** Reads every verified lesson projection referenced by curriculum contexts. */
const readMaterials = Effect.fn("contentRelease.readProgramMaterials")(
  function* (
    materialSlot: ModelSlot,
    route: CurriculumRoute,
    contexts: readonly CurriculumRoute[]
  ) {
    // The exact context index and decoded route schema prove material ownership.
    const materialKeys = new Set(
      yield* Effect.forEach(contexts, ({ materialKey }) =>
        Effect.fromNullishOr(materialKey).pipe(Effect.orDie)
      )
    );
    const source = yield* MaterialSource;
    const projections: string[] = [];
    for (const materialKey of materialKeys) {
      const remaining = PROGRAM_MATERIAL_LIMIT - projections.length;
      const rows = yield* source.siblings(
        materialSlot,
        route.appLocale,
        materialKey,
        Math.min(PROGRAM_RELATED_LIMIT, remaining) + 1
      );
      if (rows.length > PROGRAM_RELATED_LIMIT || rows.length > remaining) {
        return yield* releaseFail(
          "CONTENT_RELEASE_LIMIT",
          `Materials for ${route.appLocale}/${route.publicPath} exceed ${PROGRAM_MATERIAL_LIMIT} rows.`
        );
      }
      const verified = yield* Effect.forEach(rows, (row) =>
        verifyMaterial(row).pipe(
          Effect.map(({ projectionJson }) => projectionJson)
        )
      );
      projections.push(...verified);
    }
    return projections;
  }
);
/** Resolves every bounded relationship needed by one curriculum page. */
export const readProgramModel = Effect.fn("contentRelease.readProgramModel")(
  function* (
    snapshotId: string,
    route: CurriculumRoute,
    activeAppLocales: ActiveAppLocaleList,
    materialSlot: ModelSlot
  ) {
    const [alternates, ancestors, children, contexts] = yield* Effect.all([
      readAlternates(
        snapshotId,
        route.programKey,
        route.nodeKey,
        activeAppLocales
      ),
      readAncestors(snapshotId, route),
      readRelatedRows(snapshotId, route, "children"),
      readRelatedRows(snapshotId, route, "contexts"),
    ]);
    const [, verifiedContexts] = yield* Effect.all([
      Effect.forEach(children, (row) => verifyCurriculum(row, snapshotId), {
        discard: true,
      }),
      Effect.forEach(contexts, (row) => verifyCurriculum(row, snapshotId)),
    ]);
    const [groups, materialJson] = yield* Effect.all([
      readGroups(snapshotId, route, verifiedContexts),
      readMaterials(materialSlot, route, verifiedContexts),
    ]);
    return {
      alternates,
      ancestors,
      children,
      contexts,
      groups,
      materialJson,
    };
  }
);
