import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { PrintableLetter } from "@repo/backend/confect/records/letter";
import { Schema } from "effect";

/** The printable copy of an issued SKL, and the lock that `draw` writes once its PDF is stored (ADR 0033, S6). */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalQuery({
      name: "printable",
      args: () => ({ letterId: Id("graduationLetters") }),
      returns: () => PrintableLetter,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "lock",
      args: () => ({
        letterId: Id("graduationLetters"),
        storageId: Id("_storage"),
      }),
      returns: () => Schema.Null,
    })
  );
