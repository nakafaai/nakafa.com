// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { meetingOf } from "@repo/design-system/components/contents/mathematics/journey/meet";
import { stagesOf } from "@repo/design-system/components/contents/mathematics/journey/trip";
import { Option } from "effect";

/** A bus that goes out 12 km, waits at a stop, then goes 8 km more. */
const BUS = stagesOf({
  depart: 0,
  from: 0,
  legs: [
    { change: 12, minutes: 15 },
    { change: 0, minutes: 10 },
    { change: 8, minutes: 20 },
  ],
});

describe("where two travellers meet", () => {
  it("finds a motorbike that leaves later catching the bus at its stop", () => {
    const bike = stagesOf({
      depart: 10,
      from: 0,
      legs: [{ change: 20, minutes: 20 }],
    });
    expect(meetingOf(BUS, bike)).toEqual(
      Option.some({ distance: 12, minute: 22 })
    );
  });

  it("finds a motorbike coming from the other end", () => {
    const bike = stagesOf({
      depart: 0,
      from: 20,
      legs: [{ change: -20, minutes: 40 }],
    });
    expect(meetingOf(BUS, bike)).toEqual(
      Option.some({ distance: 12, minute: 16 })
    );
  });

  it("counts the moment the bus reaches a traveller who waits there", () => {
    const waiting = stagesOf({
      depart: 0,
      from: 12,
      legs: [
        { change: 0, minutes: 15 },
        { change: 8, minutes: 10 },
      ],
    });
    expect(meetingOf(BUS, waiting)).toEqual(
      Option.some({ distance: 12, minute: 15 })
    );
  });

  it("finds no meeting when the lines never cross, or never share a moment", () => {
    const ahead = stagesOf({
      depart: 0,
      from: 30,
      legs: [{ change: 0, minutes: 10 }],
    });
    expect(Option.isNone(meetingOf(BUS, ahead))).toBe(true);
    const late = stagesOf({
      depart: 60,
      from: 0,
      legs: [{ change: 30, minutes: 20 }],
    });
    expect(Option.isNone(meetingOf(BUS, late))).toBe(true);
  });
});
