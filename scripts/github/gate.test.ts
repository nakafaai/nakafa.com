import { describe, expect, it } from "@effect/vitest";
import { Effect, Result } from "effect";
import { type GateInput, validateGate } from "#scripts/github/gate";

const required: GateInput = {
  fullOutcome: "success",
  productionOutcome: "success",
  productionRequired: true,
  role: "required",
  scopeOutcome: "success",
  trusted: true,
};

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
});
