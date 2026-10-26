import { describe, expect, it } from "@effect/vitest";
import type { Audit } from "@repo/backend/scripts/load/ledger";
import { BLUEPRINT_PLAN } from "@repo/backend/scripts/load/plan";
import {
  type LoadReport,
  markdownOf,
  passes,
} from "@repo/backend/scripts/load/report";
import type { Latency } from "@repo/backend/scripts/load/stats";

/** A latency whose percentiles all read `p95`. */
const latency = (p95: number): Latency => ({
  count: 10,
  failed: 0,
  max: p95,
  p50: p95,
  p95,
  p99: p95,
});

const clean: Audit = {
  acknowledged: 10,
  ahead: 0,
  duplicated: 0,
  lost: 0,
  mismatched: 0,
  stored: 10,
  unacknowledged: 0,
};

const fast = {
  "mutation:answer": latency(80),
  "mutation:enter": latency(120),
  "mutation:finish": latency(200),
};

describe("load report", () => {
  it("passes a run under every target with no answer lost", () => {
    expect(passes(fast, clean)).toBe(true);
    expect(passes({ ...fast, "sync:reconnect": latency(1200) }, clean)).toBe(
      true
    );
  });

  it("fails a slow answer, a slow resync, a missing call, or any lost, duplicated or changed answer", () => {
    expect(passes({ ...fast, "mutation:answer": latency(150) }, clean)).toBe(
      false
    );
    expect(passes({ ...fast, "sync:reconnect": latency(5000) }, clean)).toBe(
      false
    );
    expect(passes({ "mutation:answer": latency(80) }, clean)).toBe(false);
    expect(passes(fast, { ...clean, lost: 1 })).toBe(false);
    expect(passes(fast, { ...clean, duplicated: 1 })).toBe(false);
    expect(passes(fast, { ...clean, mismatched: 1 })).toBe(false);
  });

  it("prints the verdict, both latency tables sorted by call, and the audit", () => {
    const report: LoadReport = {
      audit: clean,
      client: { "query:paper": latency(40.4), ...fast },
      endedAt: 61_000,
      passed: false,
      plan: BLUEPRINT_PLAN,
      server: { "mutation:exams/sittings:answer": latency(12.6) },
      startedAt: 1000,
    };
    const text = markdownOf(report);
    expect(text).toContain(
      "Verdict: fail. 3000 students in 50 rooms, 40 questions in 20 minutes, 60 s."
    );
    expect(text).toContain("| mutation:answer | 10 | 0 | 80 | 80 | 80 | 80 |");
    expect(text.indexOf("mutation:finish")).toBeLessThan(
      text.indexOf("query:paper")
    );
    expect(text).toContain(
      "| mutation:exams/sittings:answer | 10 | 0 | 13 | 13 | 13 | 13 |"
    );
    expect(text).toContain("| Audit | 10 | 10 | 0 | 0 | 0 | 0 | 0 |");
    expect(markdownOf({ ...report, passed: true })).toContain("Verdict: pass.");
  });
});
