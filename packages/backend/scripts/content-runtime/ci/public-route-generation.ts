import { createHash } from "node:crypto";
import {
  PUBLIC_ROUTE_ROOT_SHARD,
  PUBLIC_ROUTE_SHARD_COUNT,
  PUBLIC_ROUTE_SYNC_VERSION,
} from "@repo/backend/convex/contentSync/publicRoutes/spec";
import { Effect, Schema } from "effect";
import { contentRuntimeCiError } from "./error";
import type { JsonObject } from "./generation";

export const PUBLIC_ROUTE_STATE_LIMIT = PUBLIC_ROUTE_SHARD_COUNT + 2;

const SHA_256 = /^[a-f0-9]{64}$/;

const readStringField = (row: JsonObject, field: string) =>
  Schema.decodeUnknown(Schema.String)(row[field]).pipe(
    Effect.mapError(() =>
      contentRuntimeCiError(`Production generation row is missing ${field}.`)
    )
  );

const readNumberField = (row: JsonObject, field: string) =>
  Schema.decodeUnknown(Schema.Number)(row[field]).pipe(
    Effect.mapError(() =>
      contentRuntimeCiError(`Production generation row is missing ${field}.`)
    )
  );

/** Proves every route shard belongs to the committed root projection. */
export const buildPublicRouteGeneration = Effect.fn(
  "contentRuntime.buildPublicRouteGeneration"
)(function* (rows: readonly JsonObject[]) {
  if (rows.length < 1 || rows.length >= PUBLIC_ROUTE_STATE_LIMIT) {
    return yield* contentRuntimeCiError(
      "Production publicRouteSyncState exceeded its safe read bound."
    );
  }

  const states = yield* Effect.forEach(rows, (row) =>
    Effect.gen(function* () {
      const hash = yield* readStringField(row, "hash");
      const rowCount = yield* readNumberField(row, "rowCount");
      const shard = yield* readNumberField(row, "shard");

      if (!SHA_256.test(hash)) {
        return yield* contentRuntimeCiError(
          "Production public route state has an invalid hash."
        );
      }

      return { hash, rowCount, shard };
    })
  );
  const rootStates = states.filter(
    ({ shard }) => shard === PUBLIC_ROUTE_ROOT_SHARD
  );
  if (rootStates.length !== 1) {
    return yield* contentRuntimeCiError(
      "Production public route state must contain one committed root."
    );
  }

  const root = rootStates[0];
  if (!(root && Number.isSafeInteger(root.rowCount)) || root.rowCount < 0) {
    return yield* contentRuntimeCiError(
      "Production public route root has an invalid row count."
    );
  }

  const shards = states
    .filter(({ shard }) => shard !== PUBLIC_ROUTE_ROOT_SHARD)
    .sort((left, right) => left.shard - right.shard);
  const shardNumbers = new Set<number>();
  let rowCount = 0;

  for (const shard of shards) {
    if (
      !Number.isSafeInteger(shard.shard) ||
      shard.shard < 0 ||
      shard.shard >= PUBLIC_ROUTE_SHARD_COUNT ||
      shardNumbers.has(shard.shard) ||
      !Number.isSafeInteger(shard.rowCount) ||
      shard.rowCount < 1
    ) {
      return yield* contentRuntimeCiError(
        "Production public route shard state is invalid."
      );
    }

    shardNumbers.add(shard.shard);
    rowCount += shard.rowCount;
    if (!Number.isSafeInteger(rowCount)) {
      return yield* contentRuntimeCiError(
        "Production public route row count is unsafe."
      );
    }
  }

  const hash = createHash("sha256")
    .update(
      JSON.stringify({
        shardCount: PUBLIC_ROUTE_SHARD_COUNT,
        shards,
        version: PUBLIC_ROUTE_SYNC_VERSION,
      })
    )
    .digest("hex");
  if (root.hash !== hash || root.rowCount !== rowCount) {
    return yield* contentRuntimeCiError(
      "Production public route generation is not fully committed."
    );
  }

  return { hash: root.hash, rowCount: root.rowCount };
});
