import {
  MAX_ROUTE_BATCH_BYTES,
  MAX_ROUTE_BATCH_COUNT,
} from "@nakafa/aksara-contracts/transport/limits";
import { StageRouteBatchInputSchema } from "@nakafa/aksara-contracts/transport/request";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import {
  hashBatch,
  validateStoredBatch,
} from "@repo/backend/convex/contentRelease/batch";
import {
  ReleaseError,
  releaseFail,
} from "@repo/backend/convex/contentRelease/error";
import {
  loadStaged,
  stagedBaseSequence,
} from "@repo/backend/convex/contentRelease/model";
import {
  decodeReleaseJson,
  decodeRouteJson,
  encodeRouteJson,
} from "@repo/backend/convex/contentRelease/parse";
import { stageRouteVersion } from "@repo/backend/convex/contentRelease/route";
import { stageReceiptValidator } from "@repo/backend/convex/contentRelease/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { getConvexSize, v } from "convex/values";
import { Effect, Schema } from "effect";

/** Decodes one bounded route batch through the shared wire contract. */
const decodeBatch = Effect.fn("contentRelease.decodeRouteBatch")(function* (
  releaseId: string,
  batchIndex: number,
  routeJson: readonly string[]
) {
  if (
    routeJson.length === 0 ||
    routeJson.length > MAX_ROUTE_BATCH_COUNT ||
    getConvexSize({ batchIndex, releaseId, routeJson: [...routeJson] }) >
      MAX_ROUTE_BATCH_BYTES
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Route batch ${batchIndex} exceeds its bounded transport contract.`
    );
  }
  const routes = yield* Effect.forEach(routeJson, decodeRouteJson);
  return yield* Schema.decodeUnknown(StageRouteBatchInputSchema)({
    batchIndex,
    releaseId,
    routes,
  }).pipe(
    Effect.mapError(
      () =>
        new ReleaseError({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: `Route batch ${batchIndex} violates its exact contract.`,
        })
    )
  );
});

/** Stages one canonical route batch with exact immutable retry identity. */
const stageProgram = Effect.fn("contentRelease.stageRouteBatch")(function* (
  ctx: MutationCtx,
  releaseId: string,
  batchIndex: number,
  sources: readonly string[]
) {
  const { routes } = yield* decodeBatch(releaseId, batchIndex, sources);
  const entries = routes.map((route) => ({
    route,
    routeJson: encodeRouteJson(route),
  }));
  const values = entries.map(({ routeJson }) => routeJson);
  const batchHash = yield* hashBatch("route", releaseId, batchIndex, values);
  const { release, state } = yield* loadStaged(ctx, releaseId);
  const signed = yield* decodeReleaseJson(release.releaseJson);
  if (release.status !== "staging" || release.abortingAt !== undefined) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      `Content release ${releaseId} no longer accepts route batches.`
    );
  }
  const existing = yield* Effect.promise(() =>
    ctx.db
      .query("contentBindings")
      .withIndex("by_releaseId_and_batchIndex", (query) =>
        query.eq("releaseId", releaseId).eq("batchIndex", batchIndex)
      )
      .take(MAX_ROUTE_BATCH_COUNT + 1)
  );
  if (existing.length > 0) {
    yield* validateStoredBatch(
      existing.length,
      values.length,
      existing.map(({ batchHash: storedHash }) => storedHash),
      batchHash,
      releaseId,
      batchIndex
    );
    return { batchIndex, created: 0, releaseId, unchanged: values.length };
  }
  if (release.stagedRoutes + values.length > signed.manifest.routeCount) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Route batch ${batchIndex} exceeds the signed route count.`
    );
  }
  const priorSequence = stagedBaseSequence(release.role, state);
  for (const { route, routeJson } of entries) {
    yield* stageRouteVersion(
      ctx,
      route,
      routeJson,
      batchIndex,
      batchHash,
      release.sequence,
      priorSequence
    );
  }
  yield* Effect.promise(() =>
    ctx.db.patch("contentReleases", release._id, {
      stagedRoutes: release.stagedRoutes + values.length,
      updatedAt: Date.now(),
    })
  );
  return { batchIndex, created: values.length, releaseId, unchanged: 0 };
});

/** Stages one bounded immutable route batch through internal state. */
export const stageRouteBatch = internalMutation({
  args: {
    batchIndex: v.number(),
    releaseId: v.string(),
    routeJson: v.array(v.string()),
  },
  returns: stageReceiptValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      stageProgram(ctx, args.releaseId, args.batchIndex, args.routeJson)
    ),
});
