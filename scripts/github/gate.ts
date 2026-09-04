import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Config, Effect, Schema } from "effect";
import { writeOutput } from "#scripts/output";

export const GateOutcomeSchema = Schema.Literals([
  "cancelled",
  "failure",
  "skipped",
  "success",
]);
export const GateRoleSchema = Schema.Literals(["doctor", "required"]);
export const GateInputSchema = Schema.Struct({
  fullOutcome: GateOutcomeSchema,
  productionOutcome: GateOutcomeSchema,
  productionRequired: Schema.Boolean,
  role: GateRoleSchema,
  scopeOutcome: GateOutcomeSchema,
  trusted: Schema.Boolean,
});
export type GateInput = Schema.Schema.Type<typeof GateInputSchema>;

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

/** Validates one terminal pull-request check without implicit skipping. */
export const validateGate = Effect.fn("CiGate.validate")(function* (
  input: GateInput
) {
  yield* requireOutcome(input.scopeOutcome, "success", "Scope");
  if (!input.trusted && input.productionRequired) {
    return yield* new CiGateError({
      message: "Untrusted pull request requested signed production acceptance.",
    });
  }

  yield* requireOutcome(
    input.fullOutcome,
    "success",
    input.role === "doctor" ? "React Doctor" : "Quality acceptance"
  );
  if (input.role === "doctor") {
    return "React Doctor completed on the current pull-request head.";
  }

  const expectedProduction =
    input.trusted && input.productionRequired ? "success" : "skipped";
  yield* requireOutcome(
    input.productionOutcome,
    expectedProduction,
    "Production acceptance"
  );
  return "Required acceptance completed on the current pull-request head.";
});

const decodeConfig = <S extends Schema.Constraint>(name: string, schema: S) =>
  Config.nonEmptyString(name).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(schema)),
    Effect.mapError(
      (cause) =>
        new CiGateError({
          cause,
          message: `${name} has an invalid CI value.`,
        })
    )
  );

/** Runs the terminal check adapter at the Node CLI boundary. */
export const runGate = Effect.fn("CiGate.run")(function* (roleInput: unknown) {
  const role = yield* Schema.decodeUnknownEffect(GateRoleSchema)(
    roleInput
  ).pipe(
    Effect.mapError(
      (cause) => new CiGateError({ cause, message: "CI gate role is invalid." })
    )
  );
  const [fullOutcome, productionOutcome, scopeOutcome] = yield* Effect.all([
    decodeConfig("FULL_OUTCOME", GateOutcomeSchema),
    decodeConfig("PRODUCTION_OUTCOME", GateOutcomeSchema),
    decodeConfig("SCOPE_OUTCOME", GateOutcomeSchema),
  ]);
  const flags = yield* Config.all({
    productionRequired: Config.boolean("PRODUCTION_REQUIRED"),
    trusted: Config.boolean("TRUSTED_CANDIDATE"),
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
    fullOutcome,
    productionOutcome,
    productionRequired: flags.productionRequired,
    role,
    scopeOutcome,
    trusted: flags.trusted,
  });
  yield* writeOutput(`${message}\n`);
});

type GateRunner = (program: Effect.Effect<void, unknown>) => void;

/** Starts the Node adapter only for the executable module. */
export function launchGate(
  isMain: boolean,
  roleInput: unknown,
  runner: GateRunner
) {
  if (!isMain) {
    return;
  }
  runner(
    runGate(roleInput).pipe(
      Effect.tapError(() => writeOutput("ERROR: CI gate failed.\n")),
      Effect.provide(NodeServices.layer)
    )
  );
}

launchGate(import.meta.main, process.argv[2], NodeRuntime.runMain);
