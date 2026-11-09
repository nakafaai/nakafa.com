import { Table } from "@confect/core";
import { Schema } from "effect";

/** How many comments a page holds, replies counted, kept exact by the comment trigger. */
export default Table.make(() =>
  Schema.Struct({
    count: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
    slug: Schema.String,
  })
).index("by_slug", ["slug"]);
