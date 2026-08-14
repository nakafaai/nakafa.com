import { defineTable } from "convex/server";
import { v } from "convex/values";

const tables = {
  /** Compact source-projection hashes used to skip unchanged route shards. */
  publicRouteSyncState: defineTable({
    hash: v.string(),
    rowCount: v.number(),
    shard: v.number(),
  }).index("by_shard", ["shard"]),
};

export default tables;
