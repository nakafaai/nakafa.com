import { describe, expect, it } from "@effect/vitest";
import {
  percentile,
  type Sample,
  spreadByName,
  spreadOf,
} from "@repo/backend/scripts/load/stats";
import { Array as Arr } from "effect";

/** One successful sample of a call. */
const ok = (name: string, value: number): Sample => ({
  failed: false,
  name,
  value,
});

describe("load stats", () => {
  it("reads a percentile by the nearest rank, and zero from no samples", () => {
    const sorted = Arr.makeBy(100, (index) => index + 1);
    expect(percentile(sorted, 50)).toBe(50);
    expect(percentile(sorted, 95)).toBe(95);
    expect(percentile(sorted, 99)).toBe(99);
    expect(percentile([7], 99)).toBe(7);
    expect(percentile([], 95)).toBe(0);
  });

  it("counts a failed call in the latency, as the student waited for it too", () => {
    const latency = spreadOf([
      ok("mutation:answer", 30),
      { failed: true, value: 500, name: "mutation:answer" },
      ok("mutation:answer", 10),
      ok("mutation:answer", 20),
    ]);
    expect(latency).toEqual({
      count: 4,
      failed: 1,
      max: 500,
      p50: 20,
      p95: 500,
      p99: 500,
    });
  });

  it("reports no call as zero everywhere", () => {
    expect(spreadOf([])).toEqual({
      count: 0,
      failed: 0,
      max: 0,
      p50: 0,
      p95: 0,
      p99: 0,
    });
  });

  it("groups the samples by the call they name", () => {
    const latencies = spreadByName([
      ok("mutation:answer", 12),
      ok("query:paper", 40),
      ok("mutation:answer", 8),
    ]);
    expect(latencies["mutation:answer"]).toMatchObject({ count: 2, max: 12 });
    expect(latencies["query:paper"]).toMatchObject({ count: 1, p50: 40 });
  });
});
