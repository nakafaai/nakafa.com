import { Config, Effect, Schema } from "effect";
import { runEntry } from "#scripts/entry";
import { writeOutput } from "#scripts/output";

export const GateOutcomeSchema = Schema.Literals([
  "cancelled",
  "failure",
  "skipped",
  "success",
]);
export const GateRoleSchema = Schema.Literals(["doctor", "required"]);
export const GateInputSchema = Schema.Struct({
  backendOutcome: GateOutcomeSchema,
  fullOutcome: GateOutcomeSchema,
  productionOutcome: GateOutcomeSchema,
  productionRequired: Schema.Boolean,
  role: GateRoleSchema,
  scopeOutcome: GateOutcomeSchema,
  trusted: Schema.Boolean,
});
export type GateInput = typeof GateInputSchema.Type;

export class CiGateError extends Schema.TaggedError<CiGateError>()(
  "CiGateError",
  {
    cause: Schema.optional(Schema.Unknown),
    message: Schema.String,
  }
) {}

const requireOutcome = (
  actual: GateInput["scopeOutcome"],
  expected: GateInput["scopeOutcome"],
  capability: string
) =>
  actual === expected
    ? Effect.void
    : Effect.fail(
        new CiGateError({
          message: `${capability} finished with ${actual}; expected ${expected}.`,
        })
      );

/** Validates one terminal check for a pull request or merge group without implicit skipping. */
export const validateGate = Effect.fn("CiGate.validate")(function* (
  input: GateInput
) {
  yield* requireOutcome(input.scopeOutcome, "success", "Scope");
  if (!input.trusted && input.productionRequired) {
    return yield* new CiGateError({
      message: "Untrusted candidate requested signed production acceptance.",
    });
  }

  yield* requireOutcome(
    input.fullOutcome,
    "success",
    input.role === "doctor" ? "React Doctor" : "Quality acceptance"
  );
  if (input.role === "doctor") {
    return "React Doctor completed on the current candidate.";
  }

  yield* requireOutcome(input.backendOutcome, "success", "Backend tests");
  const expectedProduction =
    input.trusted && input.productionRequired ? "success" : "skipped";
  yield* requireOutcome(
    input.productionOutcome,
    expectedProduction,
    "Production acceptance"
  );
  return "Required acceptance completed on the current candidate.";
});

const decodeConfig = <S extends Schema.Constraint>(name: string, schema: S) =>
  Config.NonEmptyString(name).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(schema)),
    Effect.mapError(
      (cause) =>
        new CiGateError({
          cause,
          message: `${name} has an invalid CI value.`,
        })
    )
  );

/** Runs the terminal check adapter and marks failures in the job log. */
export const runGate = Effect.fn("CiGate.run")(
  function* (roleInput: unknown) {
    const role = yield* Schema.decodeUnknownEffect(GateRoleSchema)(
      roleInput
    ).pipe(
      Effect.mapError(
        (cause) =>
          new CiGateError({ cause, message: "CI gate role is invalid." })
      )
    );
    const [fullOutcome, productionOutcome, scopeOutcome] = yield* Effect.all([
      decodeConfig("FULL_OUTCOME", GateOutcomeSchema),
      decodeConfig("PRODUCTION_OUTCOME", GateOutcomeSchema),
      decodeConfig("SCOPE_OUTCOME", GateOutcomeSchema),
    ]);
    // Only the required check waits for the backend suite. The Doctor job never runs it.
    const backendOutcome =
      role === "required"
        ? yield* decodeConfig("BACKEND_OUTCOME", GateOutcomeSchema)
        : "skipped";
    const flags = yield* Config.all({
      productionRequired: Config.Boolean("PRODUCTION_REQUIRED"),
      trusted: Config.Boolean("TRUSTED_CANDIDATE"),
    }).pipe(
      Effect.mapError(
        (cause) =>
          new CiGateError({
            cause,
            message: "CI gate flags are incomplete.",
          })
      )
    );
    const message = yield* validateGate({
      backendOutcome,
      fullOutcome,
      productionOutcome,
      productionRequired: flags.productionRequired,
      role,
      scopeOutcome,
      trusted: flags.trusted,
    });
    yield* writeOutput(`${message}\n`);
  },
  Effect.tapError(() => writeOutput("ERROR: CI gate failed.\n"))
);

runEntry(import.meta.main, runGate(process.argv[2]));
