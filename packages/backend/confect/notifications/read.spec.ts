import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";

/**
 * Marks one page of the unread rows of one Person, and schedules the next page
 * when rows remain. A read-all request schedules the first page of each Person.
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "run",
    args: () => ({
      cursor: Schema.NullOr(Schema.String),
      personId: Id("tenantPeople"),
      readAt: Schema.Finite,
    }),
    returns: () => Schema.Null,
  })
);
