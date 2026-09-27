import { FunctionSpec, GroupSpec } from "@confect/core";
import { ReleaseErrorWire } from "@repo/backend/confect/contentRelease/error";
import {
  protectedArgsValidator,
  protectedResultValidator,
} from "@repo/backend/content/tryout/spec";
export default GroupSpec.make().addFunction(
  FunctionSpec.internalQuery({
    name: "read",
    args: () => protectedArgsValidator,
    returns: () => protectedResultValidator,
    error: () => ReleaseErrorWire,
  })
);
