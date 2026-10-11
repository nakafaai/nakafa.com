import { Table } from "@confect/core";
import { compactionPhaseValidator } from "@repo/backend/confect/contentRelease/spec";
import { Schema } from "effect";

/**
 * The one compaction row: the completed floor and the cycle in flight. It lives
 * apart from `contentState` because every content read loads that row, so each
 * compaction page that wrote it made Convex run all of those queries again.
 * Field names match the `contentState` fields this row replaces.
 */
export default Table.make(() =>
  Schema.Struct({
    compactCursor: Schema.optionalKey(Schema.String),
    compactFloor: Schema.optionalKey(Schema.Finite),
    compactFrom: Schema.optionalKey(Schema.Finite),
    compactPhase: Schema.optionalKey(compactionPhaseValidator),
    compactStartedAt: Schema.optionalKey(Schema.Finite),
    compactedFloor: Schema.Finite,
    key: Schema.Literal("primary"),
  })
).index("by_key", ["key"]);
