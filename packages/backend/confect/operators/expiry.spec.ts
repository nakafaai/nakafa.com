import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";

/**
 * Ends visits when their term runs out. `visit` is scheduled once, at the moment
 * an approved visit stores as its end, so no query reads the clock. `sweep` runs
 * on a cron and ends every due visit whose own run never happened.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalMutation({
      name: "visit",
      args: () => ({ visitId: Id("tenantVisits") }),
      returns: () => Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "sweep",
      args: () => ({}),
      returns: () => Schema.Null,
    })
  );
