import { FunctionSpec, GroupSpec } from "@confect/core";
import { ReleaseErrorWire } from "@repo/backend/confect/contentRelease/error";
import { activeIdentityValidator } from "@repo/backend/content/publication/spec";
export default GroupSpec.make().addFunction(
  FunctionSpec.publicQuery({
    name: "read",
    args: () => ({}),
    returns: () => activeIdentityValidator,
    error: () => ReleaseErrorWire,
  })
);
