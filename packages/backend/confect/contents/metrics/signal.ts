import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { toContentAnalyticsIoError } from "@repo/backend/confect/contents/analytics/spec";
import type { PopularitySignalDelta } from "@repo/backend/confect/contents/metrics/batch";
import { Effect } from "effect";

/**
 * Applies one verified daily popularity signal delta. The batch only holds
 * days inside the window, so every view in it is added to the counter and
 * `applied.d7` is exactly what the day will subtract when it expires.
 */
export const applyPopularitySignal = Effect.fn(
  "contents.metrics.applyPopularitySignal"
)(function* (
  delta: PopularitySignalDelta & {
    readonly updatedAt: number;
  }
) {
  const database = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const currentRow = yield* database
    .table("learningPopularitySignals")
    .get(
      "by_scopeMode_and_signalDay_and_content_id_and_contextKey",
      delta.scopeMode,
      delta.signalDay,
      delta.ref.content_id,
      delta.context.contextKey
    )
    .pipe(Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)));
  if (!currentRow) {
    yield* writer.table("learningPopularitySignals").insert({
      ...delta.ref,
      ...delta.context,
      applied: { d7: delta.viewCount },
      ...(delta.description === undefined
        ? {}
        : {
            description: delta.description,
          }),
      locale: delta.locale,
      ...(delta.materialDomain === undefined
        ? {}
        : {
            materialDomain: delta.materialDomain,
          }),
      route: delta.route,
      section: delta.section,
      scopeMode: delta.scopeMode,
      signalDay: delta.signalDay,
      sourcePath: delta.sourcePath,
      title: delta.title,
      updatedAt: delta.updatedAt,
      viewCount: delta.viewCount,
    });
    return;
  }
  yield* writer.table("learningPopularitySignals").patch(currentRow._id, {
    ...delta.ref,
    ...delta.context,
    contextMaterialKey: delta.context.contextMaterialKey,
    contextNodeKey: delta.context.contextNodeKey,
    contextParentPath: delta.context.contextParentPath,
    contextProgramKey: delta.context.contextProgramKey,
    contextPublicPath: delta.context.contextPublicPath,
    contextSourcePath: delta.context.contextSourcePath,
    // Rewriting `applied` also drops the windows older rows still carry.
    applied: { d7: currentRow.applied.d7 + delta.viewCount },
    description: delta.description,
    locale: delta.locale,
    materialDomain: delta.materialDomain,
    route: delta.route,
    section: delta.section,
    scopeMode: delta.scopeMode,
    signalDay: delta.signalDay,
    sourcePath: delta.sourcePath,
    title: delta.title,
    updatedAt: delta.updatedAt,
    viewCount: currentRow.viewCount + delta.viewCount,
  });
}, Effect.mapError(toContentAnalyticsIoError));
