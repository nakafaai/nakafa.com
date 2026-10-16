import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";

/**
 * Deletes the inbox rows of a released Person, one page per run. The release
 * deletes the first page itself and schedules this run for the rest.
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "run",
    args: () => ({ personId: Id("tenantPeople") }),
    returns: () => Schema.Null,
  })
);
