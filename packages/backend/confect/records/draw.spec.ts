import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";

/**
 * The drawing of a school's records (ADR 0033, S5 and S6), in the Node runtime
 * where the PDF renderer runs: each reads its printable copy, draws the PDF,
 * stores it, and locks the record with its file. Only an approval or an issue
 * schedules them.
 */
export default GroupSpec.makeNode()
  .addFunction(
    FunctionSpec.internalNodeAction({
      name: "report",
      args: () => ({ reportId: Id("reportCards") }),
      returns: () => Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.internalNodeAction({
      name: "letter",
      args: () => ({ letterId: Id("graduationLetters") }),
      returns: () => Schema.Null,
    })
  );
