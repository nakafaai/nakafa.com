import { FunctionSpec, GroupSpec } from "@confect/core";
import { agentArticleTaxonomyValidator } from "@repo/backend/confect/contentRelease/article/spec";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import { appLocaleValidator } from "@repo/backend/confect/contentRelease/spec";
export default GroupSpec.make().addFunction(
  FunctionSpec.internalQuery({
    name: "readAgentTaxonomy",
    args: () => ({
      appLocale: appLocaleValidator,
    }),
    returns: () => agentArticleTaxonomyValidator,
    error: () => ReleaseError,
  })
);
