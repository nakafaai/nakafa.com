import { FunctionSpec, GroupSpec } from "@confect/core";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import { snapshotFamilyValidator } from "@repo/backend/confect/contentRelease/spec";
import { Schema } from "effect";

/** Most batches one row page may join; each ledger read is one document. */
const MAX_RUN_BATCHES = 128;
/** Most row JSON one page may start another batch under, far below a query's read limit. */
export const MAX_RUN_BYTES = 8 * 1024 * 1024;

const rowPageValidator = Schema.Struct({
  batchIndex: Schema.Finite,
  done: Schema.Boolean,
  firstIndex: Schema.Finite,
  nextBatchIndex: Schema.Finite,
  rowJson: Schema.mutable(Schema.Array(Schema.String)),
  snapshotId: Schema.String,
});
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalQuery({
      name: "manifest",
      args: () => ({
        family: snapshotFamilyValidator,
        releaseId: Schema.String,
      }),
      returns: () => Schema.String,
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "rows",
      args: () => ({
        afterBatchIndex: Schema.Int.check(Schema.isGreaterThanOrEqualTo(-1)),
        family: snapshotFamilyValidator,
        maxBatches: Schema.Int.check(
          Schema.isBetween({ minimum: 1, maximum: MAX_RUN_BATCHES })
        ),
        maxBytes: Schema.Int.check(
          Schema.isBetween({ minimum: 1, maximum: MAX_RUN_BYTES })
        ),
        releaseId: Schema.String,
      }),
      returns: () => rowPageValidator,
      error: () => ReleaseError,
    })
  );
