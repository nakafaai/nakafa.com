import { FunctionSpec, GroupSpec } from "@confect/core";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import { activeIdentityValidator } from "@repo/backend/content/publication/spec";
import { Schema } from "effect";

const snapshotDateValidator = Schema.Union([Schema.String, Schema.Null]);
const snapshotDatesValidator = Schema.Struct({
  assessment: snapshotDateValidator,
  program: snapshotDateValidator,
  quran: snapshotDateValidator,
});

export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicQuery({
      name: "read",
      args: () => ({}),
      returns: () => activeIdentityValidator,
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "dates",
      args: () => ({}),
      returns: () => snapshotDatesValidator,
      error: () => ReleaseError,
    })
  );
