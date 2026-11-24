import { FunctionSpec, GroupSpec } from "@confect/core";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import {
  repinPageArgsValidator,
  repinReceiptValidator,
  repinRunArgsValidator,
} from "@repo/backend/confect/tryouts/repin/spec";

export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalMutation({
      name: "page",
      args: () => repinPageArgsValidator.fields,
      returns: () => repinReceiptValidator,
      error: () => ReleaseError,
    }).middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.internalAction({
      name: "run",
      args: () => repinRunArgsValidator.fields,
      returns: () => repinReceiptValidator,
      error: () => ReleaseError,
    })
  );
