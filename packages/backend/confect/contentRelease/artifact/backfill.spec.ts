import { FunctionSpec, GroupSpec } from "@confect/core";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import { Schema } from "effect";

/** Cumulative progress of the temporary artifact facts backfill. */
export const backfillReceiptValidator = Schema.Struct({
  created: Schema.Finite,
  cursor: Schema.NullOr(Schema.String),
  done: Schema.Boolean,
  scanned: Schema.Finite,
  stripped: Schema.Finite,
});

/**
 * Moves legacy artifact retention into artifact facts.
 *
 * Temporary: the artifact facts contract change deletes this group after dev
 * and production report a complete pass that changes nothing.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalMutation({
      name: "page",
      args: () => ({
        cursor: Schema.NullOr(Schema.String),
      }),
      returns: () => backfillReceiptValidator,
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.internalAction({
      name: "run",
      args: () => ({
        cursor: Schema.NullOr(Schema.String),
      }),
      returns: () => backfillReceiptValidator,
      error: () => ReleaseError,
    })
  );
