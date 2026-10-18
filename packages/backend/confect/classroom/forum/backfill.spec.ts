import { FunctionSpec, GroupSpec } from "@confect/core";
import { Schema } from "effect";

/** What one page of the backfill did, and where the next page starts. */
const BackfillPage = Schema.Struct({
  continueCursor: Schema.String,
  created: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  done: Schema.Boolean,
});

/**
 * One-off backfill of the general channel for each class created before channels
 * existed. A call reads one page of classes in creation order, after `cursor`
 * (absent for the first page), and writes the general channel of each class on the
 * page that lacks one. A repeated call writes nothing.
 *
 * The orchestrator runs it on the dev deployment and on production with `convex
 * run`, from the first page until `done` is true. The change that deletes this
 * function, its implementation and its tests follows those runs.
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "general",
    args: () => ({ cursor: Schema.optionalKey(Schema.String) }),
    returns: () => BackfillPage,
  })
);
