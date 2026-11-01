import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";

/**
 * Deletes what Insight keeps about an archived period's students, one page per run (ADR 0035). Archiving a period
 * schedules the first run. It is internal.
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "run",
    args: () => ({ periodId: Id("tenantPeriods") }),
    returns: () => Schema.Null,
  })
);
