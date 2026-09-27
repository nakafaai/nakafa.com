import { Table } from "@confect/core";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    leaseExpiresAt: Schema.Finite,
    leaseVersion: Schema.Finite,
    lastProcessedAt: Schema.optionalKey(Schema.Finite),
    partition: Schema.Finite,
  })
).index("by_partition", ["partition"]);
