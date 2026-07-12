import { publicRouteSyncStateValidator } from "@repo/backend/convex/contentSync/publicRoutes/spec";
import { defineTable } from "convex/server";

const tables = {
  /** Compact source-projection hashes used to skip unchanged route shards. */
  publicRouteSyncState: defineTable(publicRouteSyncStateValidator.fields).index(
    "by_shard",
    ["shard"]
  ),
};

export default tables;
