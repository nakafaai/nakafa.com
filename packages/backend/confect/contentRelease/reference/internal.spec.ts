import { FunctionSpec, GroupSpec } from "@confect/core";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import {
  agentContentSourceValidator,
  contentReferenceInputValidator,
} from "@repo/backend/confect/contentRelease/reference/spec";
export default GroupSpec.make().addFunction(
  FunctionSpec.internalQuery({
    name: "readAgentContent",
    args: () => ({
      input: contentReferenceInputValidator,
    }),
    returns: () => agentContentSourceValidator,
    error: () => ReleaseError,
  })
);
