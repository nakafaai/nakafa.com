// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  letterSide,
  routeOf,
  travelledOf,
} from "@repo/design-system/components/contents/mathematics/journey/plot";
import { stagesOf } from "@repo/design-system/components/contents/mathematics/journey/trip";

/** Out 12 km in 15 minutes, a 10 minute stop, then back 12 km in 20 minutes. */
const BUS = stagesOf({
  depart: 0,
  from: 0,
  legs: [
    { change: 12, minutes: 15 },
    { change: 0, minutes: 10 },
    { change: -12, minutes: 20 },
  ],
});

/** A motorbike that leaves 10 minutes late from 12 km away and rides back to the start. */
const BIKE = stagesOf({
  depart: 10,
  from: 12,
  legs: [{ change: -12, minutes: 20 }],
});

const TOPS = { km: 12, minute: 50 } as const;

describe("the lines of the distance-time graph", () => {
  it("has a corner where the traveller starts and at the end of every leg", () => {
    expect(routeOf(BUS)).toEqual([
      { km: 0, minute: 0 },
      { km: 12, minute: 15 },
      { km: 12, minute: 25 },
      { km: 0, minute: 45 },
    ]);
    expect(routeOf(BIKE)).toEqual([
      { km: 12, minute: 10 },
      { km: 0, minute: 30 },
    ]);
  });

  it("draws nothing before the traveller leaves", () => {
    expect(travelledOf(BIKE, 9)).toEqual([]);
    expect(travelledOf(BIKE, 10)).toEqual([{ km: 12, minute: 10 }]);
  });

  it("draws the corners passed and then where the traveller is now", () => {
    expect(travelledOf(BUS, 20)).toEqual([
      { km: 0, minute: 0 },
      { km: 12, minute: 15 },
      { km: 12, minute: 20 },
    ]);
    expect(travelledOf(BUS, 15)).toEqual([
      { km: 0, minute: 0 },
      { km: 12, minute: 15 },
    ]);
  });

  it("draws the whole line once the traveller has arrived", () => {
    expect(travelledOf(BUS, 60)).toEqual(routeOf(BUS));
  });
});

describe("the letter of a corner", () => {
  it("stands over a corner on the time axis, never among the axis numbers", () => {
    expect(
      letterSide({ km: 0, minute: 0 }, [{ km: 12, minute: 15 }], TOPS, 1.8)
    ).toBe("right");
    expect(
      letterSide({ km: 0, minute: 45 }, [{ km: 12, minute: 25 }], TOPS, 1.8)
    ).toBe("right");
  });

  it("stands outside the bend of a peak and of a valley", () => {
    expect(
      letterSide(
        { km: 12, minute: 15 },
        [
          { km: 0, minute: 0 },
          { km: 12, minute: 25 },
        ],
        TOPS,
        1.8
      )
    ).toBe("top");
    expect(
      letterSide(
        { km: 4, minute: 20 },
        [
          { km: 12, minute: 10 },
          { km: 12, minute: 30 },
        ],
        TOPS,
        1.8
      )
    ).toBe("bottom");
  });

  it("stands to the left of a corner whose lines leave up and to the right", () => {
    expect(
      letterSide(
        { km: 6, minute: 20 },
        [
          { km: 12, minute: 21 },
          { km: 6, minute: 40 },
        ],
        TOPS,
        1.8
      )
    ).toBe("left");
  });

  it("takes the top of a lone point", () => {
    expect(letterSide({ km: 6, minute: 20 }, [], TOPS, 1.8)).toBe("top");
  });
});
