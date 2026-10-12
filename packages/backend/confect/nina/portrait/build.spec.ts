import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";

export default GroupSpec.makeNode().addFunction(
  // Builds the portrait of a learner once a request for one has had its quiet.
  // A memory that is saved, added, deleted or rewritten schedules it, and no
  // learner waits for it.
  FunctionSpec.internalNodeAction({
    name: "run",
    args: () => ({ userId: Id("users") }),
    returns: () => Schema.Null,
  })
);
