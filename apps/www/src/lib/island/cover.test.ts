// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { createCover, stepCover } from "@/lib/island/cover";

/** A cover after `seconds` of one weather, stepped as the painter does, sixty times a second. */
function after(
  cover: ReturnType<typeof createCover>,
  weather: Parameters<typeof stepCover>[1],
  seconds: number
) {
  for (let step = 0; step < seconds * 60; step += 1) {
    stepCover(cover, weather, 1 / 60);
  }
  return cover;
}

describe("island/cover", () => {
  it("soaks the ground in half a minute of rain and dries it in the sun over four", () => {
    const cover = createCover();
    after(cover, "rain", 15);
    expect(cover.wet).toBeCloseTo(0.5, 2);
    after(cover, "rain", 30);
    expect(cover.wet).toBe(1);
    after(cover, "clear", 120);
    expect(cover.wet).toBeCloseTo(0.5, 2);
    after(cover, "clear", 200);
    expect(cover.wet).toBe(0);
    expect(after(createCover(), "storm", 13).wet).toBe(1);
  });

  it("lays snow over two and a half minutes, keeps it while it snows, and melts it faster in rain than in sun", () => {
    const cover = after(createCover(), "snow", 160);
    expect(cover.snow).toBe(1);
    expect(cover.wet).toBe(0);
    const sun = after({ ...cover }, "clear", 60);
    const rain = after({ ...cover }, "rain", 60);
    expect(sun.snow).toBeCloseTo(0.8, 2);
    expect(rain.snow).toBe(0);
  });

  it("moves the cover on no more than a quarter second for a frame that came late", () => {
    const cover = createCover();
    stepCover(cover, "storm", 600);
    expect(cover.wet).toBeCloseTo(0.25 / 12, 6);
    stepCover(cover, "storm", -5);
    expect(cover.wet).toBeCloseTo(0.25 / 12, 6);
  });
});
