import type { internal } from "@repo/backend/convex/_generated/api";
import {
  PUBLIC_ROUTE_SHARD_COUNT,
  PUBLIC_ROUTE_SYNC_VERSION,
} from "@repo/backend/convex/contentSync/publicRoutes/spec";
import { computeHash } from "@repo/backend/scripts/lib/mdx-parser/content";
import { listPublicRoutes } from "@repo/contents/_types/route/projection";
import type { PublicRoute } from "@repo/contents/_types/route/schema";
import type { FunctionArgs } from "convex/server";
import { Effect, Schema } from "effect";

type SyncShardsArgs = FunctionArgs<
  typeof internal.contentSync.publicRoutes.internal.syncShards
>;
type PublicRouteShard = SyncShardsArgs["shards"][number];
type PublicRouteSyncRow = PublicRouteShard["routes"][number];

export interface PublicRouteProjection {
  hash: string;
  rowCount: number;
  shards: PublicRouteShard[];
}

class PublicRouteProjectionError extends Schema.TaggedError<PublicRouteProjectionError>()(
  "PublicRouteProjectionError",
  { message: Schema.String }
) {}

/** Builds deterministic route shards and hashes from the source projection. */
export const readPublicRouteProjection = Effect.fn(
  "sync.readPublicRouteProjection"
)(function* () {
  const sourceRoutes = yield* listPublicRoutes();
  const identities = new Set<string>();
  const routesByShard = new Map<number, PublicRouteSyncRow[]>();

  for (const sourceRoute of sourceRoutes) {
    const values = toPublicRouteValues(sourceRoute);
    const identity = getRouteIdentity(values);

    if (identities.has(identity)) {
      return yield* Effect.fail(
        new PublicRouteProjectionError({
          message: `Duplicate public route identity: ${identity}.`,
        })
      );
    }

    identities.add(identity);
    const route = {
      ...values,
      contentHash: computeHash(JSON.stringify(values)),
    };
    const shard = getRouteShard(identity);
    const rows = routesByShard.get(shard) ?? [];
    rows.push(route);
    routesByShard.set(shard, rows);
  }

  const shards = [...routesByShard.entries()]
    .sort(([left], [right]) => left - right)
    .map(([shard, routes]) => buildShard(shard, routes));
  const hash = computeHash(
    JSON.stringify({
      shardCount: PUBLIC_ROUTE_SHARD_COUNT,
      shards: shards.map(({ hash: shardHash, routes, shard }) => ({
        hash: shardHash,
        rowCount: routes.length,
        shard,
      })),
      version: PUBLIC_ROUTE_SYNC_VERSION,
    })
  );

  return { hash, rowCount: sourceRoutes.length, shards };
});

/** Sorts and hashes one shard independently from all other route shards. */
function buildShard(
  shard: number,
  unsortedRoutes: PublicRouteSyncRow[]
): PublicRouteShard {
  const routes = [...unsortedRoutes].sort((left, right) =>
    getRouteIdentity(left).localeCompare(getRouteIdentity(right))
  );
  const hash = computeHash(
    JSON.stringify(
      routes.map((route) => [route.locale, route.publicPath, route.contentHash])
    )
  );

  return { hash, routes, shard };
}

/** Maps one route identity to its stable bounded sync shard. */
function getRouteShard(identity: string) {
  const prefix = computeHash(identity).slice(0, 8);
  return Number.parseInt(prefix, 16) % PUBLIC_ROUTE_SHARD_COUNT;
}

/** Builds a collision-safe identity from one locale and public route path. */
function getRouteIdentity(
  route: Pick<PublicRouteSyncRow, "locale" | "publicPath">
) {
  return JSON.stringify([route.locale, route.publicPath]);
}

/** Converts one source route into learner-facing durable route fields. */
function toPublicRouteValues(route: PublicRoute) {
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
