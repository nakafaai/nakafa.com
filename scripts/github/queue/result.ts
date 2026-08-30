import { Effect, Schema } from "effect";
import { queueGateError } from "#scripts/github/queue/admission";

export const GateEventSchema = Schema.Literals(["merge_group", "pull_request"]);
export const GateOutcomeSchema = Schema.Literals([
  "cancelled",
  "failure",
  "skipped",
  "success",
]);
export const GateRoleSchema = Schema.Literals(["doctor", "required"]);
export const GateInputSchema = Schema.Struct({
  event: GateEventSchema,
  fullOutcome: GateOutcomeSchema,
  productionOutcome: GateOutcomeSchema,
  productionRequired: Schema.Boolean,
  reuse: Schema.Boolean,
  reviewOutcome: GateOutcomeSchema,
  role: GateRoleSchema,
  scopeOutcome: GateOutcomeSchema,
  trusted: Schema.Boolean,
});
export type GateInput = Schema.Schema.Type<typeof GateInputSchema>;

const requireOutcome = (
  actual: GateInput["scopeOutcome"],
  expected: GateInput["scopeOutcome"],
  capability: string
) =>
  actual === expected
    ? Effect.void
    : Effect.fail(
        queueGateError(
          `${capability} finished with ${actual}; expected ${expected}.`
        )
      );

/** Validates the terminal Required or Doctor check without implicit skipping. */
export const validateGateResult = Effect.fn("QueueGate.validateResult")(
  function* (input: GateInput) {
    yield* requireOutcome(input.scopeOutcome, "success", "Queue scope");
    if (input.event === "merge_group" && !input.trusted) {
      return yield* queueGateError(
        "Merge-group acceptance is not in the trusted release lane."
      );
    }
    if (input.reuse && input.event !== "merge_group") {
      return yield* queueGateError(
        "Source proof may only be reused for a merge-group event."
      );
    }
    if (!input.trusted && input.productionRequired) {
      return yield* queueGateError(
        "Untrusted pull request requested signed production acceptance."
      );
    }

    yield* requireOutcome(
      input.fullOutcome,
      "success",
      input.role === "doctor" ? "React Doctor" : "Quality acceptance"
    );

    if (input.role === "doctor") {
      return "React Doctor completed on the current tree.";
    }

    const expectedProduction =
      input.trusted && input.productionRequired ? "success" : "skipped";
    yield* requireOutcome(
      input.productionOutcome,
      expectedProduction,
      "Production acceptance"
    );
    yield* requireOutcome(
      input.reviewOutcome,
      input.event === "merge_group" ? "success" : "skipped",
      "Final review verification"
    );

    return input.reuse
      ? "Reused exact-head test proof after current security audit, Production, and final review verification."
      : "Required acceptance completed on the current tree.";
  }
);
