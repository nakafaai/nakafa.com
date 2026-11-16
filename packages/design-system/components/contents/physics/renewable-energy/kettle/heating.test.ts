import { describe, expect, it } from "@effect/vitest";
import {
  BOILING_POINT,
  boilTime,
  heatNeeded,
  START_TEMPERATURE,
  TEMPERATURE_RISE,
  waterTemperature,
} from "@repo/design-system/components/contents/physics/renewable-energy/kettle/heating";

describe("electric kettle", () => {
  it("needs m c ΔT to bring water from 25 °C to the boil", () => {
    expect(TEMPERATURE_RISE).toBe(75);
    expect(heatNeeded("half")).toBe(157_500);
    expect(heatNeeded("full")).toBe(315_000);
    expect(heatNeeded("brim")).toBe(472_500);
  });

  it("takes twice as long for twice the water", () => {
    expect(boilTime("half")).toBe(75);
    expect(boilTime("full")).toBe(150);
    expect(boilTime("brim")).toBe(225);
  });

  it("warms the water steadily and holds it at the boil", () => {
    expect(waterTemperature("full", -3)).toBe(START_TEMPERATURE);
    expect(waterTemperature("full", 20)).toBe(35);
    expect(waterTemperature("half", 20)).toBe(45);
    expect(waterTemperature("full", 400)).toBe(BOILING_POINT);
  });
});
