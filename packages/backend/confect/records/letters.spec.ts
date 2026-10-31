import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { PrintableLetter } from "@repo/backend/confect/records/letter";
import { Schema } from "effect";

/**
 * The drawing of an issued SKL's PDF (ADR 0033, S6): `draw` reads the letter's printable
 * copy, draws the PDF, stores it, and `lock` locks the letter with its file. Only an issue
 * schedules them.
 */
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
  )
  .addFunction(
    FunctionSpec.internalAction({
      name: "draw",
      args: () => ({ letterId: Id("graduationLetters") }),
      returns: () => Schema.Null,
    })
  );
