// @vitest-environment node

import { type CheckResult, getChecksSorted, runChecks } from "afdocs";
import { loadConfig } from "afdocs/helpers";
import { beforeAll, describe, expect, it } from "vitest";

const AGENT_DOCS_TIMEOUT_MS = 300_000;
const ALLOWED_SKIP_CHECKS = new Set(["auth-alternative-access"]);

describe("Agent-Friendly Documentation", () => {
  let resultsByCheck: Map<string, CheckResult>;

  beforeAll(async () => {
    const config = await loadConfig();
    const inferredSamplingStrategy =
      config.pages?.length && !config.options?.samplingStrategy
        ? "curated"
        : undefined;
    const report = await runChecks(config.url, {
      checkIds: config.checks,
      skipCheckIds: config.skipChecks,
      ...config.options,
      ...(inferredSamplingStrategy && {
        samplingStrategy: inferredSamplingStrategy,
      }),
      curatedPages: config.pages,
    });

    resultsByCheck = new Map(
      report.results.map((result) => [result.id, result])
    );
  }, AGENT_DOCS_TIMEOUT_MS);

  for (const check of getChecksSorted()) {
    it(check.id, () => {
      const result = resultsByCheck.get(check.id);

      expect(result, `${check.id} did not run`).toBeDefined();

      if (!result || result.status === "pass") {
        return;
      }

      if (result.status === "skip" && ALLOWED_SKIP_CHECKS.has(result.id)) {
        return;
      }

      expect.fail(`[${result.status}] ${result.message}`);
    });
  }
});
