import { describe, expect, it } from "@effect/vitest";
import { Effect, Result } from "effect";
import { validateGateResult } from "#scripts/github/queue/result";

const fullRequired = {
  event: "pull_request" as const,
  fullOutcome: "success" as const,
  productionOutcome: "success" as const,
  productionRequired: true,
  reviewOutcome: "skipped" as const,
  reuse: false,
  role: "required" as const,
  scopeOutcome: "success" as const,
  trusted: true,
};

describe("terminal CI result", () => {
  it.effect("accepts complete source production proof", () =>
    validateGateResult(fullRequired).pipe(
      Effect.tap((message) =>
        Effect.sync(() => {
          expect(message).toContain("current tree");
        })
      )
    )
  );

  it.effect(
    "accepts exact-tree Quality reuse with current Production and review proof",
    () =>
      validateGateResult({
        event: "merge_group",
        fullOutcome: "success",
        productionOutcome: "success",
        productionRequired: true,
        reviewOutcome: "success",
        reuse: true,
        role: "required",
        scopeOutcome: "success",
        trusted: true,
      }).pipe(
        Effect.tap((message) =>
          Effect.sync(() => {
            expect(message).toContain("current security audit");
          })
        )
      )
  );

  it.effect("requires full Doctor on an exact-tree Quality reuse", () =>
    validateGateResult({
      event: "merge_group",
      fullOutcome: "success",
      productionOutcome: "skipped",
      productionRequired: true,
      reviewOutcome: "skipped",
      reuse: true,
      role: "doctor",
      scopeOutcome: "success",
      trusted: true,
    }).pipe(
      Effect.tap((message) =>
        Effect.sync(() => {
          expect(message).toContain("current tree");
        })
      )
    )
  );

  it.effect("rejects skipped full Doctor on an exact-tree Quality reuse", () =>
    validateGateResult({
      event: "merge_group",
      fullOutcome: "skipped",
      productionOutcome: "skipped",
      productionRequired: true,
      reviewOutcome: "skipped",
      reuse: true,
      role: "doctor",
      scopeOutcome: "success",
      trusted: true,
    }).pipe(
      Effect.result,
      Effect.tap((result) =>
        Effect.sync(() => {
          expect(Result.isFailure(result)).toBe(true);
        })
      )
    )
  );

  it.effect("rejects a stale Quality job on an exact-tree test reuse", () =>
    validateGateResult({
      event: "merge_group",
      fullOutcome: "skipped",
      productionOutcome: "success",
      productionRequired: true,
      reviewOutcome: "success",
      reuse: true,
      role: "required",
      scopeOutcome: "success",
      trusted: true,
    }).pipe(
      Effect.result,
      Effect.tap((result) =>
        Effect.sync(() => {
          expect(Result.isFailure(result)).toBe(true);
        })
      )
    )
  );

  it.effect("fails closed when a required production step was skipped", () =>
    validateGateResult({
      ...fullRequired,
      productionOutcome: "skipped",
    }).pipe(
      Effect.result,
      Effect.tap((result) =>
        Effect.sync(() => {
          expect(Result.isFailure(result)).toBe(true);
        })
      )
    )
  );
});
