import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";

/**
 * Answers a turn whose message carries a document, in the Node runtime. The
 * default runtime cannot hold a document's bytes in memory, so the run reads
 * the document there (ADR 0019). It runs the same program as `nina/response`.
 */
export default GroupSpec.makeNode().addFunction(
  FunctionSpec.internalNodeAction({
    name: "run",
    args: () => ({ turnId: Id("ninaTurns") }),
    returns: () => Schema.Null,
  })
);
