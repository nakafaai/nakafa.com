import { FunctionSpec, GroupSpec } from "@confect/core";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import {
  contentReferenceInputValidator,
  contentReferenceReturnValidator,
} from "@repo/backend/confect/contentRelease/reference/spec";
export default GroupSpec.make().addFunction(
  FunctionSpec.publicQuery({
    name: "read",
    args: () => ({
      input: contentReferenceInputValidator,
    }),
    returns: () => contentReferenceReturnValidator,
    error: () => ReleaseError,
  })
);
