import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";

/**
 * The scheduled steps of a sitting and its attempts: the opening, the closing in pages,
 * the close of one attempt after added minutes, and the submission. Only the scheduler
 * calls them, with no identity, so they carry no access check (ADR 0013).
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalMutation({
      name: "open",
      args: () => ({ sittingId: Id("examSittings") }),
      returns: () => Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "closeDue",
      args: () => ({
        atDeadline: Schema.Literals(["closesAt", "now"]),
        sittingId: Id("examSittings"),
      }),
      returns: () => Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "closeAttempt",
      args: () => ({ attemptId: Id("examAttempts") }),
      returns: () => Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "submit",
      args: () => ({ attemptId: Id("examAttempts") }),
      returns: () => Schema.Null,
    })
  );
