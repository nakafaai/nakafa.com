import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Option } from "effect";
import { runTimings } from "#scripts/proof/run";
import { GATE_JOB, RUN, step } from "#scripts/proof/test.github";

describe("proof run", () => {
  it("reads the phases of the one machine that ran a small selection, beside the engine jobs that ended", () => {
    const [, chromium, firefox, webkit] = RUN.jobs;
    const ended = (job: typeof firefox) => ({
      ...job,
      completedAt: job.startedAt,
      steps: Arr.map(job.steps, (one) => ({ ...one, conclusion: "skipped" })),
    });
    const timings = runTimings({
      ...RUN,
      jobs: [GATE_JOB, ended(firefox), chromium, ended(webkit)],
    });

    expect(timings.prepare).toEqual(Option.some(4));
    expect(timings.restored).toEqual(Option.some(true));
    expect(timings.build).toEqual(Option.some(18));
    expect(timings.specs).toEqual(Option.some(12));
  });

  it("reads no phase that a run never reached", () => {
    expect(
      runTimings({
        ...RUN,
        jobs: [
          {
            ...GATE_JOB,
            conclusion: "cancelled",
            startedAt: null,
            steps: [
              { ...step("Gate static", 5, 12), completedAt: null },
              { ...step("Prepare", 16, 20), completedAt: null },
              { ...step("Run specs", 38, 48), startedAt: null },
            ],
          },
        ],
      })
    ).toEqual({
      queue: Option.none(),
      gate: Option.none(),
      prepare: Option.none(),
      restored: Option.none(),
      build: Option.none(),
      specs: Option.none(),
      total: Option.some(50),
    });
    expect(runTimings({ ...RUN, jobs: [] }).queue).toEqual(Option.none());
    // A proof alone skips the gate job, which then counts for no phase, and a
    // phase that one engine left unfinished has none while the others finished.
    const [, chromium, firefox, webkit] = RUN.jobs;
    const alone = runTimings({
      ...RUN,
      jobs: [
        { ...GATE_JOB, conclusion: "skipped", steps: [] },
        chromium,
        firefox,
        {
          ...webkit,
          conclusion: "cancelled",
          steps: Arr.map(webkit.steps, (one) =>
            one.name === "Run specs" ? { ...one, completedAt: null } : one
          ),
        },
      ],
    });
    expect(alone.queue).toEqual(Option.some(5));
    expect(alone.gate).toEqual(Option.none());
    expect(alone.build).toEqual(Option.some(20));
    expect(alone.specs).toEqual(Option.none());
  });
});
