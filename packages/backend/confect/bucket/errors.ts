import { Schema } from "effect";

/** The bucket is full, a school passed its own limit, or the day's free operations are spent. */
export class StorageFull extends Schema.TaggedError<StorageFull>()(
  "StorageFull",
  { reason: Schema.Literals(["bucket", "school", "operations"]) }
) {}
