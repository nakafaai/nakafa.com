import { FunctionSpec, GroupSpec } from "@confect/core";
import { Schema } from "effect";

/**
 * Temporary maintenance function. No feature reads or writes the bookmark
 * tables any more, and the owner approved the disposal of their rows on 10
 * October 2026, as ADR 0003 asks. One call deletes one bounded batch from each
 * table and returns how many rows it deleted. It runs until both counts are
 * zero, on dev and on production, and it is deleted together with the tables.
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "purgeBookmarks",
    args: () => ({}),
    returns: () =>
      Schema.Struct({
        bookmarks: Schema.Finite,
        collections: Schema.Finite,
      }),
  })
);
