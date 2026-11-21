// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  lastMinute,
  minuteFocus,
  partFocus,
  REST_SECONDS,
  RUN_SECONDS,
  startClock,
  tickClock,
  wholeFocus,
} from "@repo/design-system/components/contents/mathematics/journey/clock";
import { stagesOf } from "@repo/design-system/components/contents/mathematics/journey/trip";
import { Option } from "effect";

/** A bus that goes out 12 km in 15 minutes and waits 10 minutes at a stop. */
const BUS = stagesOf({
  depart: 0,
  from: 0,
  legs: [
    { change: 12, minutes: 15 },
    { change: 0, minutes: 10 },
  ],
});

describe("the clock Play runs", () => {
  it("starts where the learner left it, or from the beginning once the journey has ended", () => {
    expect(startClock(10, 25)).toEqual({ minute: 10, rest: 0 });
    expect(startClock(25, 25)).toEqual({ minute: 0, rest: 0 });
  });

  it("runs a journey through in the same time however long it lasts, rests, and starts again", () => {
    expect(tickClock({ minute: 0, rest: 0 }, RUN_SECONDS / 2, 90)).toEqual({
      minute: 45,
      rest: 0,
    });
    const ended = tickClock({ minute: 80, rest: 0 }, RUN_SECONDS, 90);
    expect(ended).toEqual({ minute: 90, rest: 0 });
    const resting = tickClock(ended, REST_SECONDS / 2, 90);
    expect(resting).toEqual({ minute: 90, rest: REST_SECONDS / 2 });
    expect(tickClock(resting, REST_SECONDS, 90)).toEqual({
      minute: 0,
      rest: 0,
    });
  });
});

describe("what the lab looks at", () => {
  it("shows the whole journey at its end, and a leg at the moment it ends", () => {
    expect(wholeFocus(25)).toEqual({ minute: 25, part: Option.none() });
    expect(partFocus(BUS, 0)).toEqual({ minute: 15, part: Option.some(0) });
  });

  it("follows the clock to the leg under way", () => {
    expect(minuteFocus(BUS, 20)).toEqual({ minute: 20, part: Option.some(1) });
  });

  it("ends the journey when the later traveller arrives", () => {
    const bike = stagesOf({
      depart: 5,
      from: 0,
      legs: [{ change: 12, minutes: 30 }],
    });
    expect(lastMinute([BUS, bike])).toBe(35);
  });
});
