import { describe, expect, it } from "@effect/vitest";
import {
  createParameterStore,
  sliderDigits,
} from "@/lib/content/renderer/client/base/visual/parameters";

describe("parameter store", () => {
  it("starts at each slider's value and moves one slider alone", () => {
    const store = createParameterStore({ a: 1, k: 2 });

    store.getState().move("a", 1.5);

    expect(store.getState().values).toStrictEqual({ a: 1.5, k: 2 });
  });
});

describe("slider digits", () => {
  it.each([
    { min: 0, step: 1, digits: 0 },
    { min: 0, step: 5, digits: 0 },
    { min: 0, step: 0.5, digits: 1 },
    { min: 0, step: 0.25, digits: 2 },
    { min: 0, step: 0.05, digits: 2 },
    { min: 0.1, step: 1, digits: 1 },
    { min: 0, step: 0.1 * 3, digits: 1 },
    { min: 0, step: 0.0001, digits: 4 },
    { min: 0, step: 1 / 3, digits: 4 },
  ])(
    "shows $digits decimals for a step of $step from $min",
    ({ digits, min, step }) => {
      expect(sliderDigits({ min, step })).toBe(digits);
    }
  );

  it("shows 0.75 on a step of 0.25 instead of rounding it to 0.8", () => {
    expect((0.75).toFixed(sliderDigits({ min: 0, step: 0.25 }))).toBe("0.75");
  });
});
