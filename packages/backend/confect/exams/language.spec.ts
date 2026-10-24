import { FunctionSpec, GroupSpec } from "@confect/core";
import { Schema } from "effect";

/** What one page of the clearing did, and where the next page starts. */
const ClearPage = Schema.Struct({
  cleared: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  continueCursor: Schema.String,
  done: Schema.Boolean,
});

/**
 * One-off clearing of the exam language that exams stored before its removal hold. A call
 * reads one page of exams in creation order, after `cursor` (absent for the first page), and
 * rewrites each exam of the page that holds a language without it. A repeated call clears
 * nothing.
 *
 * The orchestrator runs it on the dev deployment and on production with `convex run`, from
 * the first page until `done` is true, and counts the exams that still hold a language before
 * the contract step. The change that deletes this function, its implementation and its tests,
 * and the language field of the exam validator, follows those runs (the rollout contract of
 * packages/backend/AGENTS.md).
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "clear",
    args: () => ({ cursor: Schema.optionalKey(Schema.String) }),
    returns: () => ClearPage,
  })
);
