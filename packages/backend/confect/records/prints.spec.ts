import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { PrintableReport } from "@repo/backend/confect/records/report";
import { Schema } from "effect";

/** The printable copy of an approved report, and the lock that `draw` writes once its PDF is stored (ADR 0033, S5). */
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
  );
