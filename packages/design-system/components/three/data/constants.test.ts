import { describe, expect, it } from "@effect/vitest";

import {
  getThreeParticleLabelFontSize,
  resolveThreeFontSize,
  THREE_FONT_SIZE,
} from "@repo/design-system/components/three/data/constants";

describe("resolveThreeFontSize", () => {
  it("reads a named font size, and passes a numeric size through", () => {
    expect(resolveThreeFontSize("reading")).toBe(THREE_FONT_SIZE.reading);
    expect(resolveThreeFontSize(0.5)).toBe(0.5);
  });
});

describe("getThreeParticleLabelFontSize", () => {
  it("scales the label to the particle, and caps it at the marker size", () => {
    expect(getThreeParticleLabelFontSize(0.1)).toBeCloseTo(0.072);
    expect(getThreeParticleLabelFontSize(1)).toBe(THREE_FONT_SIZE.marker);
  });
});
