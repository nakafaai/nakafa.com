import { FunctionSpec, GroupSpec } from "@confect/core";
import {
  GatewayConfigurationError,
  GatewayFailure,
} from "@repo/backend/confect/gateway/failure";
import { EmbeddingModelId } from "@repo/backend/confect/gateway/model";
import { localeValidator } from "@repo/backend/confect/lib/validators/contents";
import { Schema } from "effect";

/** A question and the section that answers it, named by the identity of its document and its place in it. */
const questionValidator = Schema.Struct({
  contentKey: Schema.String,
  ordinal: Schema.Finite,
  question: Schema.String,
});

/** An embedding model, a language, and the questions to put to the stored sections of that language. */
export const compareInputValidator = Schema.Struct({
  locale: localeValidator,
  model: EmbeddingModelId,
  questions: Schema.Array(questionValidator),
});

/**
 * What one question found: the milliseconds its embedding took and, when the
 * stored sections hold the section it names, the heading of that section and
 * its rank among the embedded sections of the language, one being the best. A
 * section that the model would not embed ranks after all the others.
 */
const verdictValidator = Schema.Struct({
  milliseconds: Schema.Finite,
  section: Schema.NullOr(
    Schema.Struct({ heading: Schema.String, rank: Schema.Finite })
  ),
});

/** What ends a run without verdicts: the deployment cannot reach the gateway, or the gateway refuses a request. */
export const compareFailureValidator = Schema.Union([
  GatewayConfigurationError,
  GatewayFailure,
]);

/**
 * The verdicts, in the order of the questions, with the number of sections that
 * were embedded and ranked (`pool`) and the number that the model would not
 * take (`refused`); `empty` when no section of the language is stored; or
 * `failed` with the failure that ended the run.
 *
 * A failure is an answer and not a failure of the call, because the Convex CLI
 * that runs the model test prints a failed call as text and drops the typed data
 * of its error, so the reason would not reach the report.
 */
export const compareResultValidator = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("empty") }),
  Schema.Struct({
    kind: Schema.Literal("ranked"),
    pool: Schema.Finite,
    refused: Schema.Finite,
    verdicts: Schema.Array(verdictValidator),
  }),
  Schema.Struct({
    kind: Schema.Literal("failed"),
    failure: compareFailureValidator,
  }),
]);

/**
 * The model test: embeds every stored section of a language and every question
 * with one candidate embedding model, and tells where each question's section
 * ranks. The index holds the vectors of the chosen model only, so a candidate
 * is judged on vectors it makes here and keeps nowhere. A section that a
 * candidate would not embed is counted and ranks last, as a build with that
 * model would leave it out of the index.
 */
export default GroupSpec.makeNode().addFunction(
  FunctionSpec.internalNodeAction({
    name: "rank",
    args: () => compareInputValidator.fields,
    returns: () => compareResultValidator,
  })
);
