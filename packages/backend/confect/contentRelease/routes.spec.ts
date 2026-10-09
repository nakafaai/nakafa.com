import { FunctionSpec, GroupSpec } from "@confect/core";
import contentBindingsTable from "@repo/backend/confect/_generated/tables/contentBindings";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import { stageReceiptValidator } from "@repo/backend/confect/contentRelease/spec";
import { Schema, Struct } from "effect";

/** Decodes one bounded route batch through the shared wire contract. */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "stageRouteBatch",
    args: () => ({
      ...contentBindingsTable.Fields.mapFields(
        Struct.pick(["batchIndex", "releaseId"])
      ).fields,
      routeJson: Schema.mutable(Schema.Array(Schema.String)),
    }),
    returns: () => stageReceiptValidator,
    error: () => ReleaseError,
  })
);
