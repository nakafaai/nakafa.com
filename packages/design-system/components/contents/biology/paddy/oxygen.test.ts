// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  aeratedLength,
  aerobicShare,
  airOxygen,
  channelOxygen,
  DIFFUSION,
  ethanolYield,
  FLOODED,
  fermentationEnergy,
  oxicDepth,
  ROOT_DEPTH,
  rootOxygen,
  rootState,
  rootsSurvive,
  soilDemand,
  soilDiffusion,
  soilOxygen,
  surfaceOxygen,
  waterOxygen,
} from "@repo/design-system/components/contents/biology/paddy/oxygen";

describe("oxygen in paddy soil", () => {
  it("moves oxygen about ten thousand times more slowly through water than through air", () => {
    const ratio = DIFFUSION.air / DIFFUSION.water;
    expect(ratio).toBeGreaterThan(5000);
    expect(ratio).toBeLessThan(15_000);
  });

  it("holds the oxygen of air and of air-saturated water at 25 °C", () => {
    expect(airOxygen()).toBeCloseTo(8.563, 3);
    expect(waterOxygen()).toBeCloseTo(0.2581, 4);
  });

  it("slows diffusion through soil pores by Millington and Quirk", () => {
    expect(soilDiffusion("drained")).toBeCloseTo(6.93e-7, 9);
    expect(soilDiffusion("flooded")).toBeCloseTo(8.334e-10, 12);
  });

  it("reads the soil's oxygen demand back from the measured flooded profile", () => {
    expect(soilDemand()).toBeCloseTo(5.834e-5, 8);
    expect(oxicDepth("flooded")).toBeCloseTo(FLOODED.depth, 12);
  });

  it("lets oxygen reach tens of centimetres into drained soil but millimetres under water", () => {
    expect(oxicDepth("drained")).toBeCloseTo(0.451, 3);
    expect(oxicDepth("drained")).toBeGreaterThan(ROOT_DEPTH);
    expect(oxicDepth("flooded")).toBeLessThan(0.0035);
  });

  it("falls with depth from the air or the floodwater to nothing", () => {
    expect(surfaceOxygen("drained")).toBe(1);
    expect(surfaceOxygen("flooded")).toBeCloseTo(0.5423, 4);
    expect(soilOxygen("drained", -0.05)).toBe(1);
    expect(soilOxygen("drained", 0.1)).toBeCloseTo(0.6057, 4);
    expect(soilOxygen("drained", ROOT_DEPTH)).toBeCloseTo(0.3098, 4);
    expect(soilOxygen("flooded", 0.001)).toBeCloseTo(0.1356, 4);
    expect(soilOxygen("flooded", 0.1)).toBe(0);
  });
});

describe("air channels in roots", () => {
  it("lets rice carry air further down its roots than a dryland crop", () => {
    expect(aeratedLength("rice")).toBeCloseTo(0.2955, 4);
    expect(aeratedLength("dryland")).toBeCloseTo(0.0349, 4);
  });

  it("keeps air to the tip of a rice root but not of a dryland root", () => {
    expect(channelOxygen("rice", 0)).toBe(1);
    expect(channelOxygen("rice", ROOT_DEPTH)).toBeCloseTo(0.5419, 4);
    expect(channelOxygen("dryland", 0.02)).toBeCloseTo(0.1822, 4);
    expect(channelOxygen("dryland", 0.1)).toBe(0);
  });

  it("gives root cells the better of the soil and their own channels", () => {
    expect(rootOxygen("dryland", "drained", 0.1)).toBeCloseTo(0.6057, 4);
    expect(rootOxygen("dryland", "flooded", 0.1)).toBe(0);
    expect(rootOxygen("rice", "flooded", 0.1)).toBeCloseTo(0.6564, 4);
  });
});

describe("respiration and fermentation", () => {
  it("respires aerobically wherever any oxygen reaches the cell", () => {
    expect(aerobicShare(1)).toBe(1);
    expect(aerobicShare(0)).toBe(0);
    expect(aerobicShare(0.3)).toBeGreaterThan(0.998);
  });

  it("makes every ATP by fermentation, and 2 ethanol a glucose, without oxygen", () => {
    expect(fermentationEnergy(0, 30)).toBe(1);
    expect(fermentationEnergy(1, 30)).toBe(0);
    expect(fermentationEnergy(0.5, 30)).toBeCloseTo(2 / 32, 12);
    expect(ethanolYield(0)).toBe(2);
    expect(ethanolYield(1)).toBe(0);
  });

  it("ferments in flooded dryland roots while flooded rice roots stay aerobic", () => {
    const dryland = rootState("dryland", "flooded", ROOT_DEPTH, 30);
    const rice = rootState("rice", "flooded", ROOT_DEPTH, 30);
    expect(dryland.energy).toBe(1);
    expect(dryland.ethanol).toBe(2);
    expect(rice.energy).toBeLessThan(0.001);
    expect(rice.ethanol).toBeLessThan(0.01);
  });

  it("keeps rice roots alive in a flood but not dryland roots", () => {
    expect(rootsSurvive("rice", "flooded")).toBe(true);
    expect(rootsSurvive("dryland", "flooded")).toBe(false);
    expect(rootsSurvive("dryland", "drained")).toBe(true);
  });
});
