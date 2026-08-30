// @vitest-environment node

import { beforeAll, describe, expect, it } from "@effect/vitest";
import type { CheckResult } from "afdocs";
import { Effect } from "effect";
import { runAfdocs } from "@/checks/afdocs";

const TIMEOUT_MS = 600_000;
const ALLOWED_SKIPS = new Set(["auth-alternative-access"]);

/** Keeps a failed CI check actionable without dumping every passing page. */
function formatFailureDetails(details: Record<string, unknown> | undefined) {
  if (!details) {
    return "";
  }

  const { pageResults, ...summary } = details;
  if (!Array.isArray(pageResults)) {
    return `\n${JSON.stringify(details, null, 2)}`;
  }

  const failures = pageResults.filter(
    (page) =>
      typeof page === "object" &&
      page !== null &&
      "status" in page &&
      page.status !== "pass"
  );

  return `\n${JSON.stringify({ ...summary, pageResults: failures }, null, 2)}`;
}

describe("AFDocs", () => {
  let results: readonly {
    readonly check: { readonly id: string };
    readonly result: CheckResult | undefined;
  }[];

  beforeAll(async () => {
    results = await Effect.runPromise(runAfdocs());
  }, TIMEOUT_MS);

  it("runs the configured site contract", () => {
    expect(results.length).toBeGreaterThan(0);

    for (const { check, result } of results) {
      expect(result, `${check.id} did not run`).toBeDefined();
      if (!result || result.status === "pass") {
        continue;
      }
      if (result.status === "skip" && ALLOWED_SKIPS.has(result.id)) {
        continue;
      }
      expect.fail(
        `[${result.status}] ${result.message}${formatFailureDetails(result.details)}`
      );
    }
  });
});
