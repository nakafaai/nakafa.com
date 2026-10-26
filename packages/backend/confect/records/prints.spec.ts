import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { PrintableReport } from "@repo/backend/confect/records/report";
import { Schema } from "effect";

/**
 * The drawing of an approved report's PDF (ADR 0033, S5): `draw` reads the report's
 * printable copy, draws the PDF, stores it, and `lock` locks the report with its file.
 * Only the approval schedules them.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalQuery({
      name: "printable",
      args: () => ({ reportId: Id("reportCards") }),
      returns: () => PrintableReport,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "lock",
      args: () => ({ reportId: Id("reportCards"), storageId: Id("_storage") }),
      returns: () => Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.internalAction({
      name: "draw",
      args: () => ({ reportId: Id("reportCards") }),
      returns: () => Schema.Null,
    })
  );
