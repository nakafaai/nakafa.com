import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";

/**
 * Answers a turn and presents its answer in the default runtime, which has no
 * cold start (ADR 0019). A turn whose message carries a document runs
 * `nina/documents` instead, in the Node runtime.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalAction({
      name: "run",
      args: () => ({ turnId: Id("ninaTurns") }),
      returns: () => Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.internalAction({
      name: "present",
      args: () => ({ turnId: Id("ninaTurns") }),
      returns: () => Schema.Null,
    })
  );
