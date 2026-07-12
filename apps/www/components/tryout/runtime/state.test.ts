import { describe, expect, it } from "vitest";
import {
  getActiveTryoutAttempt,
  getTryoutRuntimeState,
} from "@/components/tryout/runtime/state";

const NOW = 1000;

describe("getActiveTryoutAttempt", () => {
  it("returns an in-progress attempt before its deadline", () => {
    const attempt = createAttempt("in-progress", NOW + 1);

    expect(getActiveTryoutAttempt(attempt, NOW)).toBe(attempt);
  });

  it("rejects absent, terminal, and locally expired attempts", () => {
    expect(getActiveTryoutAttempt(null, NOW)).toBeNull();
    expect(
      getActiveTryoutAttempt(createAttempt("completed", NOW + 1), NOW)
    ).toBeNull();
    expect(
      getActiveTryoutAttempt(createAttempt("in-progress", NOW), NOW)
    ).toBeNull();
  });
});

describe("getTryoutRuntimeState", () => {
  const activeAttempt = createAttempt("in-progress", NOW + 10);

  it("returns none without a loaded runtime", () => {
    expect(
      getTryoutRuntimeState({ activeAttempt, now: NOW, runtime: null })
    ).toEqual({ kind: "none" });
  });

  it("keeps an unexpired in-progress runtime active", () => {
    const runtime = createRuntime("in-progress", NOW + 1);

    expect(getTryoutRuntimeState({ activeAttempt, now: NOW, runtime })).toEqual(
      { kind: "active", runtime }
    );
  });

  it("keeps a locally expired runtime mounted while Convex finalizes it", () => {
    const runtime = createRuntime("in-progress", NOW);

    expect(getTryoutRuntimeState({ activeAttempt, now: NOW, runtime })).toEqual(
      { kind: "pending", runtime }
    );
    expect(
      getTryoutRuntimeState({ activeAttempt: null, now: NOW, runtime })
    ).toEqual({ kind: "pending", runtime });
  });

  it("returns terminal runtimes for review", () => {
    const runtime = createRuntime("completed", NOW);

    expect(
      getTryoutRuntimeState({ activeAttempt: null, now: NOW, runtime })
    ).toEqual({ kind: "review", runtime });
  });
});

/** Create one attempt fixture with an explicit status and expiration. */
function createAttempt(status: "in-progress" | "completed", expiresAt: number) {
  return { expiresAt, status };
}

/** Create one section runtime fixture with an explicit status and expiration. */
function createRuntime(status: "in-progress" | "completed", expiresAt: number) {
  return { expiresAt, section: { status } };
}
