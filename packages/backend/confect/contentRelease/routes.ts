import { StageRouteBatchInputSchema } from "@nakafa/aksara-contracts/transport/batch";
import {
  MAX_ROUTE_BATCH_BYTES,
  MAX_ROUTE_BATCH_COUNT,
} from "@nakafa/aksara-contracts/transport/limits";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  hashBatch,
  validateStoredBatch,
} from "@repo/backend/confect/contentRelease/batch";
import {
  ReleaseError,
  releaseFail,
} from "@repo/backend/confect/contentRelease/error";
import {
  loadStaged,
  stagedBaseSequence,
} from "@repo/backend/confect/contentRelease/model";
import {
  decodeReleaseJson,
  decodeRouteJson,
} from "@repo/backend/confect/contentRelease/parse";
import { stageRouteVersion } from "@repo/backend/confect/contentRelease/route";
import { encodeRouteJson } from "@repo/backend/confect/contentRelease/wire";
import { getConvexSize } from "convex/values";
import { Clock, Effect, Schema } from "effect";

/** Decodes one bounded route batch through the shared wire contract. */
export const decodeBatch = Effect.fn("contentRelease.decodeRouteBatch")(
  function* (
    releaseId: string,
    batchIndex: number,
    routeJson: readonly string[]
  ) {
    if (
      routeJson.length === 0 ||
      routeJson.length > MAX_ROUTE_BATCH_COUNT ||
      getConvexSize({
        batchIndex,
        releaseId,
        routeJson: [...routeJson],
      }) > MAX_ROUTE_BATCH_BYTES
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_LIMIT",
        `Route batch ${batchIndex} exceeds its bounded transport contract.`
      );
    }
    const routes = yield* Effect.forEach(routeJson, decodeRouteJson);
    return yield* Schema.decodeUnknownEffect(StageRouteBatchInputSchema)({
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
  }
);
/** Stages one canonical route batch with exact immutable retry identity. */
export const stageProgram = Effect.fn("contentRelease.stageRouteBatch")(
  function* (
    releaseId: string,
    batchIndex: number,
    sources: readonly string[]
  ) {
    const database = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const { routes } = yield* decodeBatch(releaseId, batchIndex, sources);
    const entries = routes.map((route) => ({
      route,
      routeJson: encodeRouteJson(route),
    }));
    const values = entries.map(({ routeJson }) => routeJson);
    const batchHash = yield* hashBatch("route", releaseId, batchIndex, values);
    const { release, state } = yield* loadStaged(releaseId);
    const signed = yield* decodeReleaseJson(release.releaseJson);
    if (release.status !== "staging" || release.abortingAt !== undefined) {
      return yield* releaseFail(
        "CONTENT_RELEASE_STATE",
        `Content release ${releaseId} no longer accepts route batches.`
      );
    }
    const existing = yield* database
      .table("contentBindings")
      .index("by_releaseId_and_batchIndex", (query) =>
        query.eq("releaseId", releaseId).eq("batchIndex", batchIndex)
      )
      .take(MAX_ROUTE_BATCH_COUNT + 1)
      .pipe(Effect.orDie);
    if (existing.length > 0) {
      yield* validateStoredBatch(
        existing.length,
        values.length,
        existing.map(({ batchHash: storedHash }) => storedHash),
        batchHash,
        releaseId,
        batchIndex
      );
      return {
        batchIndex,
        created: 0,
        releaseId,
        unchanged: values.length,
      };
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
        route,
        routeJson,
        batchIndex,
        batchHash,
        release.sequence,
        priorSequence
      );
    }
    yield* writer
      .table("contentReleases")
      .patch(release._id, {
        stagedRoutes: release.stagedRoutes + values.length,
        updatedAt: yield* Clock.currentTimeMillis,
      })
      .pipe(Effect.orDie);
    return {
      batchIndex,
      created: values.length,
      releaseId,
      unchanged: 0,
    };
  }
);
