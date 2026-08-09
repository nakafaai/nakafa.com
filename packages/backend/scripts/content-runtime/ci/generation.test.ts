import { createHash } from "node:crypto";
import {
  PUBLIC_ROUTE_ROOT_SHARD,
  PUBLIC_ROUTE_SHARD_COUNT,
  PUBLIC_ROUTE_SYNC_VERSION,
} from "@repo/backend/convex/contentSync/publicRoutes/spec";
import {
  buildRuntimeGenerations,
  decodeJsonRows,
  verifyRuntimeGenerations,
} from "@repo/backend/scripts/content-runtime/ci/generation";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

const contentState = [{ _creationTime: 1, _id: "state-1", sequence: 9 }];
const routeCounts = [
  { _id: "route-2", count: 2, locale: "id", section: "materials" },
  { _id: "route-1", count: 1, locale: "en", section: "articles" },
];
const sitemapCounts = [
  { _creationTime: 2, count: 2, locale: "id", syncedAt: 200 },
  { _creationTime: 1, count: 1, locale: "en", syncedAt: 100 },
];
const createPublicRouteState = (shardHash: string) => {
  const shards = [{ hash: shardHash, rowCount: 2, shard: 7 }];
  const hash = createHash("sha256")
    .update(
      JSON.stringify({
        shardCount: PUBLIC_ROUTE_SHARD_COUNT,
        shards,
        version: PUBLIC_ROUTE_SYNC_VERSION,
      })
    )
    .digest("hex");

  return [{ hash, rowCount: 2, shard: PUBLIC_ROUTE_ROOT_SHARD }, ...shards];
};
const publicRouteState = createPublicRouteState("a".repeat(64));

describe("content runtime generations", () => {
  it("is stable across source order and Convex system fields", async () => {
    const baseline = await Effect.runPromise(
      buildRuntimeGenerations({
        contentState,
        publicRouteState,
        routeCounts,
        sitemapCounts,
      })
    );
    const reordered = await Effect.runPromise(
      buildRuntimeGenerations({
        contentState: [{ _creationTime: 999, _id: "different", sequence: 9 }],
        publicRouteState: [...publicRouteState].reverse(),
        routeCounts: [...routeCounts].reverse(),
        sitemapCounts: [...sitemapCounts].reverse(),
      })
    );

    expect(reordered).toEqual(baseline);
  });

  it("changes when a route or sitemap generation changes", async () => {
    const baseline = await Effect.runPromise(
      buildRuntimeGenerations({
        contentState,
        publicRouteState,
        routeCounts,
        sitemapCounts,
      })
    );
    const changed = await Effect.runPromise(
      buildRuntimeGenerations({
        contentState,
        publicRouteState: createPublicRouteState("b".repeat(64)),
        routeCounts: routeCounts.map((row) => ({
          ...row,
          count: row.count + 1,
        })),
        sitemapCounts: sitemapCounts.map((row) => ({
          ...row,
          syncedAt: row.syncedAt + 1,
        })),
      })
    );

    expect(changed.routeGenerationHash).not.toBe(baseline.routeGenerationHash);
    expect(changed.sitemapGenerationHash).not.toBe(
      baseline.sitemapGenerationHash
    );
    const verificationFailure = await Effect.runPromise(
      verifyRuntimeGenerations(
        {
          cacheVersion: "v1",
          ...baseline,
          runtimeSchemaFingerprint: "1".repeat(64),
        },
        changed
      ).pipe(Effect.flip)
    );

    expect(verificationFailure).toMatchObject({
      _tag: "ContentRuntimeCiError",
    });
  });

  it("rejects malformed or unbounded generation inputs", async () => {
    const emptyRows = await Effect.runPromise(decodeJsonRows(""));
    const malformed = await Effect.runPromise(
      buildRuntimeGenerations({
        contentState,
        publicRouteState,
        routeCounts: [{ locale: "id" }],
        sitemapCounts,
      }).pipe(Effect.flip)
    );
    const invalidJson = await Effect.runPromise(
      decodeJsonRows("not-json").pipe(Effect.flip)
    );

    expect(emptyRows).toEqual([]);
    expect(malformed).toMatchObject({ _tag: "ContentRuntimeCiError" });
    expect(invalidJson).toMatchObject({ _tag: "ContentRuntimeCiError" });
  });

  it("rejects a public route generation that is not fully committed", async () => {
    const incoherent = publicRouteState.map((row) =>
      row.shard === PUBLIC_ROUTE_ROOT_SHARD
        ? { ...row, hash: "0".repeat(64) }
        : row
    );
    const failure = await Effect.runPromise(
      buildRuntimeGenerations({
        contentState,
        publicRouteState: incoherent,
        routeCounts,
        sitemapCounts,
      }).pipe(Effect.flip)
    );

    expect(failure).toMatchObject({ _tag: "ContentRuntimeCiError" });
  });
});
