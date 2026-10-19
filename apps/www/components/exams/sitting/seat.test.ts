import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";
import type { DashboardAttempt } from "@/components/exams/sitting/change";
import {
  isDisconnected,
  lastActivityOf,
  matchesFilter,
  seatFrame,
} from "@/components/exams/sitting/seat";

const attemptId = Schema.decodeUnknownSync(Id("examAttempts"));

/** One attempt on the page, with its state, whether it is away, and its latest signal. */
function attempt(
  state: DashboardAttempt["state"],
  options: {
    readonly away?: boolean;
    readonly latestSignal?: DashboardAttempt["latestSignal"];
  } = {}
): DashboardAttempt {
  return {
    away: options.away ?? false,
    deadline: 10_000,
    id: attemptId("attempt-a"),
    lastActiveAt: 1000,
    latestSignal: options.latestSignal ?? null,
    mascot: null,
    name: "Nabila Zahra",
    state,
  };
}

describe("seatFrame", () => {
  it("draws a locked seat red, even while the student is away", () => {
    expect(seatFrame(attempt("locked", { away: true }))).toBe("locked");
  });

  it("draws a submitted seat green, even when the student left before it", () => {
    expect(seatFrame(attempt("submitted", { away: true }))).toBe("submitted");
  });

  it("draws an attempt that its student has left yellow", () => {
    expect(seatFrame(attempt("inProgress", { away: true }))).toBe("away");
  });

  it("keeps the plain frame for an attempt in progress that nothing flags", () => {
    expect(seatFrame(attempt("inProgress"))).toBe("plain");
    expect(seatFrame(attempt("closing"))).toBe("plain");
  });
});

describe("isDisconnected", () => {
  it("is true only when the latest signal is a disconnect", () => {
    const at = 1000;

    expect(
      isDisconnected(
        attempt("inProgress", {
          away: true,
          latestSignal: { at, kind: "disconnect" },
        })
      )
    ).toBe(true);
    expect(
      isDisconnected(
        attempt("inProgress", { latestSignal: { at, kind: "exit" } })
      )
    ).toBe(false);
    expect(isDisconnected(attempt("inProgress"))).toBe(false);
  });
});

describe("lastActivityOf", () => {
  it("shows the page's time until the seat's latest answer arrives", () => {
    expect(lastActivityOf(attempt("inProgress"), null)).toBe(1000);
  });

  it("shows the newer of the page's time and the latest answer", () => {
    expect(lastActivityOf(attempt("inProgress"), 5000)).toBe(5000);
    expect(lastActivityOf(attempt("inProgress"), 400)).toBe(1000);
  });
});

describe("matchesFilter", () => {
  it("shows every attempt under the all filter", () => {
    expect(matchesFilter("all", attempt("submitted"))).toBe(true);
    expect(matchesFilter("all", attempt("inProgress"))).toBe(true);
  });

  it("shows a locked attempt, or an away one, under needs attention", () => {
    expect(matchesFilter("needsAttention", attempt("locked"))).toBe(true);
    expect(
      matchesFilter("needsAttention", attempt("inProgress", { away: true }))
    ).toBe(true);
    expect(matchesFilter("needsAttention", attempt("inProgress"))).toBe(false);
  });

  it("never shows a submitted attempt under needs attention", () => {
    expect(
      matchesFilter("needsAttention", attempt("submitted", { away: true }))
    ).toBe(false);
  });

  it("shows only a submitted attempt under finished", () => {
    expect(matchesFilter("finished", attempt("submitted"))).toBe(true);
    expect(matchesFilter("finished", attempt("locked"))).toBe(false);
  });
});
