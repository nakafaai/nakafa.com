import { describe, expect, it } from "@effect/vitest";
import {
  awayFor,
  integrityOf,
} from "@repo/backend/confect/exams/sittings/away";
import { Option } from "effect";

/** The signals of one attempt, newest first, as the proctor's panel reads them. */
const signals = [
  { at: 95_000, kind: "return" as const },
  { at: 90_000, kind: "exit" as const },
  { at: 70_400, kind: "return" as const },
  { at: 60_000, kind: "return" as const },
  { at: 30_000, kind: "copy" as const },
  { at: 10_000, kind: "exit" as const },
];

describe("exams/sittings away", () => {
  it("measures an exit to the first return after it, in whole seconds", () => {
    expect(awayFor(signals, { at: 10_000 })).toEqual(Option.some(50));
    expect(awayFor(signals, { at: 90_000 })).toEqual(Option.some(5));
  });

  it("measures nothing while the student has not come back", () => {
    expect(awayFor(signals, { at: 99_000 })).toEqual(Option.none());
  });

  it("counts the exits and the seconds away in all, and no time for an exit with no return", () => {
    expect(integrityOf(signals)).toEqual({ awaySeconds: 55, exits: 2 });
    expect(
      integrityOf([...signals, { at: 120_000, kind: "exit" as const }])
    ).toEqual({ awaySeconds: 55, exits: 3 });
    expect(integrityOf([])).toEqual({ awaySeconds: 0, exits: 0 });
  });
});
