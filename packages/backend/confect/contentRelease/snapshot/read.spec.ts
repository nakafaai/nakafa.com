import { FunctionSpec, GroupSpec } from "@confect/core";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import { snapshotFamilyValidator } from "@repo/backend/confect/contentRelease/spec";
import { Schema } from "effect";

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
        releaseId: Schema.String,
      }),
      returns: () => rowPageValidator,
      error: () => ReleaseError,
    })
  );
