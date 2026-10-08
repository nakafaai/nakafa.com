import { assert, describe, expect, it } from "@effect/vitest";
import { ConfigProvider, Effect, Ref, Result, Stdio } from "effect";
import { capture, makeCapture } from "#scripts/capture";
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

/** Runs the gate adapter with one CI environment and captured job output. */
const runCapturedGate = Effect.fn("CiGateTest.runCapturedGate")(function* (
  role: string,
  environment: Record<string, string>
) {
  const stdout = yield* makeCapture;
  const result = yield* runGate(role).pipe(
    Effect.provide(
      Stdio.layerTest({
        stdout: capture(stdout),
      })
    ),
    Effect.provideService(
      ConfigProvider.ConfigProvider,
      ConfigProvider.fromEnvRecord(environment)
    ),
    Effect.result
  );
  return { result, stdout: yield* Ref.get(stdout) };
});

describe("terminal CI gate", () => {
  it.effect("accepts complete trusted production proof", () =>
    validateGate(required).pipe(
      Effect.tap((message) =>
        Effect.sync(() => {
          expect(message).toContain("current candidate");
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

  it.effect("decodes the complete required-check environment", () =>
    Effect.gen(function* () {
      const { result, stdout } = yield* runCapturedGate(
        "required",
        validEnvironment
      );
      expect(Result.isSuccess(result)).toBe(true);
      expect(stdout).toEqual([
        "Required acceptance completed on the current candidate.\n",
      ]);
    })
  );

  it.effect.each([
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
    {
      expected:
        "Production acceptance finished with skipped; expected success.",
      environment: { ...validEnvironment, PRODUCTION_OUTCOME: "skipped" },
      role: "required",
    },
  ])(
    "rejects $expected and marks the job log",
    ({ environment, expected, role }) =>
      Effect.gen(function* () {
        const { result, stdout } = yield* runCapturedGate(role, environment);
        assert(Result.isFailure(result));
        expect(result.failure.message).toBe(expected);
        expect(stdout).toEqual(["ERROR: CI gate failed.\n"]);
      })
  );
});
