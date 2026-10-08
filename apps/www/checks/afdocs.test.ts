// @vitest-environment node

import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect, HashSet, Predicate, Schema } from "effect";
import { runAfdocs } from "@/checks/afdocs";

const TIMEOUT_MS = 600_000;
const ALLOWED_SKIPS = HashSet.make("auth-alternative-access");
const PrettyJsonSchema = Schema.fromJsonString(Schema.Unknown, { space: 2 });

/** Keeps a failed CI check actionable without dumping every passing page. */
function formatFailureDetails(details: Record<string, unknown> | undefined) {
  if (!details) {
    return "";
  }

  const { pageResults, ...summary } = details;
  if (!Arr.isArray(pageResults)) {
    return `\n${Schema.encodeSync(PrettyJsonSchema)(details)}`;
  }

  const failures = pageResults.filter(
    (page) =>
      Predicate.isObject(page) &&
      Predicate.hasProperty(page, "status") &&
      page.status !== "pass"
  );

  return `\n${Schema.encodeSync(PrettyJsonSchema)({ ...summary, pageResults: failures })}`;
}

describe("AFDocs", () => {
  it.live(
    "runs the configured site contract",
    () =>
      Effect.gen(function* () {
        const results = yield* runAfdocs();
        assert.ok(results.length > 0);

        for (const { check, result } of results) {
          assert.ok(result, `${check.id} did not run`);
          if (!result || result.status === "pass") {
            continue;
          }
          if (
            result.status === "skip" &&
            HashSet.has(ALLOWED_SKIPS, result.id)
          ) {
            continue;
          }
          assert.fail(
            `[${result.status}] ${result.message}${formatFailureDetails(result.details)}`
          );
        }
      }),
    TIMEOUT_MS
  );
});
