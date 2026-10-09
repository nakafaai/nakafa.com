import { FunctionSpec, GroupSpec } from "@confect/core";
import contentIndexTable from "@repo/backend/confect/_generated/tables/contentIndex";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import { contentFamilyValidator } from "@repo/backend/confect/contentRelease/spec";
import { routeResultValidator } from "@repo/backend/content/publication/spec";
import { Struct } from "effect";

/** Returns active public-route ownership without exposing artifact code. */
export default GroupSpec.make().addFunction(
  FunctionSpec.publicQuery({
    name: "resolve",
    args: () => ({
      family: contentFamilyValidator,
      ...contentIndexTable.Fields.mapFields(
        Struct.pick(["appLocale", "publicPath"])
      ).fields,
    }),
    returns: () => routeResultValidator,
    error: () => ReleaseError,
  })
);
