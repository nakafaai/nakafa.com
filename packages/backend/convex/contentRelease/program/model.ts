import { ContentLocaleSchema } from "@nakafa/aksara-contracts/content";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { verifyMaterial } from "@repo/backend/convex/contentRelease/material/verify";
import {
  PROGRAM_ANCESTOR_LIMIT,
  PROGRAM_MATERIAL_LIMIT,
  PROGRAM_RELATED_LIMIT,
} from "@repo/backend/convex/contentRelease/program/limits";
import { verifyCurriculum } from "@repo/backend/convex/contentRelease/program/verify";
import { Effect } from "effect";

type CurriculumRoute = Effect.Effect.Success<
  ReturnType<typeof verifyCurriculum>
>;

/** Orders material groups exactly as authored, with paths as stable tie-breakers. */
function compareGroups(
  left: Doc<"curriculumRoutes">,
  right: Doc<"curriculumRoutes">
) {
  const order = left.order - right.order;
  if (order !== 0) {
    return order;
  }
  return left.path.localeCompare(right.path);
}

/** Loads one exact immutable curriculum route from the selected snapshot. */
export const loadProgramRouteRow = Effect.fn("contentRelease.loadProgramRoute")(
  function* (
    ctx: QueryCtx,
    snapshotId: string,
    locale: Doc<"curriculumRoutes">["locale"],
    publicPath: string
  ) {
    return yield* Effect.promise(() =>
      ctx.db
        .query("curriculumRoutes")
        .withIndex("by_snapshotId_and_locale_and_path", (index) =>
          index
            .eq("snapshotId", snapshotId)
            .eq("locale", locale)
            .eq("path", publicPath)
        )
        .unique()
    );
  }
);

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
  function* (ctx: QueryCtx, snapshotId: string, route: CurriculumRoute) {
    const rows: Doc<"curriculumRoutes">[] = [];
    let parentPath = route.parentPath;
    while (parentPath) {
      if (rows.length === PROGRAM_ANCESTOR_LIMIT) {
        return yield* releaseFail(
          "CONTENT_RELEASE_LIMIT",
          `Curriculum route ${route.locale}/${route.publicPath} exceeds ${PROGRAM_ANCESTOR_LIMIT} ancestors.`
        );
      }
      const parent = yield* loadProgramRouteRow(
        ctx,
        snapshotId,
        route.locale,
        parentPath
      );
      if (!parent) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          `Curriculum route ${route.locale}/${route.publicPath} lost parent ${parentPath}.`
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
    ctx: QueryCtx,
    snapshotId: string,
    programKey: string,
    nodeKey: string
  ) {
    return yield* Effect.forEach(ContentLocaleSchema.literals, (locale) =>
      Effect.promise(() =>
        ctx.db
          .query("curriculumRoutes")
          .withIndex(
            "by_snapshotId_and_locale_and_programKey_and_nodeKey",
            (index) =>
              index
                .eq("snapshotId", snapshotId)
                .eq("locale", locale)
                .eq("programKey", programKey)
                .eq("nodeKey", nodeKey)
          )
          .unique()
      ).pipe(
        Effect.flatMap((row) =>
          row
            ? verifyCurriculum(row, snapshotId).pipe(Effect.as(row))
            : releaseFail(
                "CONTENT_RELEASE_INTEGRITY",
                `Curriculum node ${programKey}/${nodeKey} lost locale ${locale}.`
              )
        )
      )
    );
  }
);

/** Reads one indexed relationship page from an immutable program snapshot. */
const readRelatedRows = Effect.fn("contentRelease.readProgramRelations")(
  function* (
    ctx: QueryCtx,
    snapshotId: string,
    route: CurriculumRoute,
    relation: "children" | "contexts"
  ) {
    const rows = yield* Effect.promise(() =>
      relation === "children"
        ? ctx.db
            .query("curriculumRoutes")
            .withIndex(
              "by_snapshotId_and_locale_and_parentPath_and_order_and_path",
              (index) =>
                index
                  .eq("snapshotId", snapshotId)
                  .eq("locale", route.locale)
                  .eq("parentPath", route.publicPath)
            )
            .take(PROGRAM_RELATED_LIMIT + 1)
        : ctx.db
            .query("curriculumRoutes")
            .withIndex(
              "by_snapshotId_and_locale_and_contextPath_and_order_and_path",
              (index) =>
                index
                  .eq("snapshotId", snapshotId)
                  .eq("locale", route.locale)
                  .eq("contextPath", route.publicPath)
            )
            .take(PROGRAM_RELATED_LIMIT + 1)
    );
    return yield* requireBoundedRows(
      rows,
      `Curriculum ${relation} for ${route.locale}/${route.publicPath}`
    );
  }
);

/** Reads every group route referenced by material-context rows. */
const readGroups = Effect.fn("contentRelease.readProgramGroups")(function* (
  ctx: QueryCtx,
  snapshotId: string,
  route: CurriculumRoute,
  contexts: readonly CurriculumRoute[]
) {
  const publicPaths = new Set(
    contexts.flatMap(({ materialContextPublicPath }) =>
      materialContextPublicPath ? [materialContextPublicPath] : []
    )
  );
  const groups = yield* Effect.forEach(publicPaths, (publicPath) =>
    loadProgramRouteRow(ctx, snapshotId, route.locale, publicPath).pipe(
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
    ctx: QueryCtx,
    route: CurriculumRoute,
    contexts: readonly CurriculumRoute[]
  ) {
    const materialKeys = new Set(
      contexts.flatMap(({ materialKey }) => (materialKey ? [materialKey] : []))
    );
    const projections: string[] = [];
    for (const materialKey of materialKeys) {
      const remaining = PROGRAM_MATERIAL_LIMIT - projections.length;
      const rows = yield* Effect.promise(() =>
        ctx.db
          .query("materialCatalog")
          .withIndex(
            "by_locale_and_materialKey_and_order_and_publicPath",
            (index) =>
              index.eq("locale", route.locale).eq("materialKey", materialKey)
          )
          .take(Math.min(PROGRAM_RELATED_LIMIT, remaining) + 1)
      );
      if (rows.length === 0) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          `Material ${route.locale}/${materialKey} is missing.`
        );
      }
      if (rows.length > PROGRAM_RELATED_LIMIT || rows.length > remaining) {
        return yield* releaseFail(
          "CONTENT_RELEASE_LIMIT",
          `Materials for ${route.locale}/${route.publicPath} exceed ${PROGRAM_MATERIAL_LIMIT} rows.`
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
  function* (ctx: QueryCtx, snapshotId: string, route: CurriculumRoute) {
    const [alternates, ancestors, children, contexts] = yield* Effect.all([
      readAlternates(ctx, snapshotId, route.programKey, route.nodeKey),
      readAncestors(ctx, snapshotId, route),
      readRelatedRows(ctx, snapshotId, route, "children"),
      readRelatedRows(ctx, snapshotId, route, "contexts"),
    ]);
    const [, verifiedContexts] = yield* Effect.all([
      Effect.forEach(children, (row) => verifyCurriculum(row, snapshotId), {
        discard: true,
      }),
      Effect.forEach(contexts, (row) => verifyCurriculum(row, snapshotId)),
    ]);
    const [groups, materialJson] = yield* Effect.all([
      readGroups(ctx, snapshotId, route, verifiedContexts),
      readMaterials(ctx, route, verifiedContexts),
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
