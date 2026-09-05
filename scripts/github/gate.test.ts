import * as NodeServices from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import { ConfigProvider, Effect, Result } from "effect";
import { type GateInput, runGate, validateGate } from "#scripts/github/gate";

const required: GateInput = {
  fullOutcome: "success",
  productionOutcome: "success",
  productionRequired: true,
  role: "required",
  scopeOutcome: "success",
  trusted: true,
};

const validEnvironment = {
  FULL_OUTCOME: "success",
  PRODUCTION_OUTCOME: "success",
  PRODUCTION_REQUIRED: "true",
  SCOPE_OUTCOME: "success",
  TRUSTED_CANDIDATE: "true",
};

const withEnvironment = <Value, Error>(
  program: Effect.Effect<Value, Error>,
  environment: Record<string, string>
) =>
  program.pipe(
    Effect.provideService(
      ConfigProvider.ConfigProvider,
      ConfigProvider.fromEnvRecord(environment)
    )
  );

describe("terminal CI gate", () => {
  it.effect("accepts complete trusted production proof", () =>
    validateGate(required).pipe(
      Effect.tap((message) =>
        Effect.sync(() => {
          expect(message).toContain("current pull-request head");
        })
      )
    )
  );

  it.effect("accepts a current Doctor result", () =>
    validateGate({
      ...required,
      productionOutcome: "skipped",
      role: "doctor",
    }).pipe(
      Effect.tap((message) =>
        Effect.sync(() => {
          expect(message).toContain("React Doctor");
        })
      )
    )
  );

  it.effect("accepts an untrusted test-only pull request", () =>
    validateGate({
      ...required,
      productionOutcome: "skipped",
      productionRequired: false,
      trusted: false,
    }).pipe(
      Effect.tap((message) =>
        Effect.sync(() => {
          expect(message).toContain("Required acceptance");
        })
      )
    )
  );

  it.effect.each([
    { input: { ...required, scopeOutcome: "failure" }, name: "scope" },
    { input: { ...required, fullOutcome: "skipped" }, name: "quality" },
    {
      input: {
        ...required,
        productionOutcome: "skipped",
        trusted: false,
      },
      name: "trust",
    },
    {
      input: { ...required, productionOutcome: "skipped" },
      name: "production",
    },
    {
      input: {
        ...required,
        productionRequired: false,
      },
      name: "unexpected production",
    },
  ] satisfies ReadonlyArray<{
    readonly input: GateInput;
    readonly name: string;
  }>)("rejects invalid $name evidence", ({ input }) =>
    validateGate(input).pipe(
      Effect.result,
      Effect.tap((result) =>
        Effect.sync(() => {
          expect(Result.isFailure(result)).toBe(true);
        })
      )
    )
  );

  it.live("decodes the complete required-check environment", () =>
    runGate("required").pipe(Effect.provide(NodeServices.layer), (program) =>
      withEnvironment(program, validEnvironment)
    )
  );

  it.live.each([
    {
      expected: "CI gate role is invalid.",
      environment: validEnvironment,
      role: "unknown",
    },
    {
      expected: "FULL_OUTCOME has an invalid CI value.",
      environment: { ...validEnvironment, FULL_OUTCOME: "unknown" },
      role: "required",
    },
    {
      expected: "CI gate flags are incomplete.",
      environment: {
        FULL_OUTCOME: "success",
        PRODUCTION_OUTCOME: "success",
        SCOPE_OUTCOME: "success",
      },
      role: "required",
    },
  ])("rejects $expected", ({ environment, expected, role }) =>
    Effect.gen(function* () {
      expect(
        yield* withEnvironment(
          runGate(role).pipe(Effect.provide(NodeServices.layer)),
          environment
        ).pipe(Effect.flip)
      ).toMatchObject({ message: expected });
    })
  );
});
