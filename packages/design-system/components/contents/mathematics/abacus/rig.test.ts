// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  BEAD,
  BOARD,
  CLEAR,
  ease,
  FLIGHT_SPEED,
  HEAP,
  legDuration,
  POT,
  SPIKE,
  STACK_SPEED,
  SUNK,
  slotY,
  spikeX,
  TIP,
  WASHER,
} from "@repo/design-system/components/contents/mathematics/abacus/rig";

describe("the spike abacus rig", () => {
  it("stands the units spike at the right and spaces the spikes evenly on the base", () => {
    expect(spikeX(0)).toBeCloseTo(0.105, 10);
    expect(spikeX(3)).toBeCloseTo(-0.105, 10);
    expect(spikeX(1) - spikeX(2)).toBeCloseTo(SPIKE.gap, 10);
    expect(BOARD.length / 2 - spikeX(0)).toBeGreaterThan(WASHER.radius);
  });

  it("stacks beads touching but never overlapping, ten of them below the tip", () => {
    expect(slotY(1) - slotY(0)).toBeCloseTo(BEAD.pitch, 10);
    expect(BEAD.height).toBeLessThan(BEAD.pitch);
    expect(slotY(0) - BEAD.height / 2).toBeGreaterThan(
      BOARD.height + WASHER.height
    );
    expect(slotY(9) + BEAD.height / 2).toBeLessThan(TIP);
    expect(BEAD.bore).toBeGreaterThan(SPIKE.radius);
  });

  it("carries beads above every tip, and lets them sink among the loose beads in the pot", () => {
    expect(CLEAR - BEAD.height / 2).toBeGreaterThan(TIP);
    expect(HEAP).toBeLessThan(POT.height);
    expect(SUNK).toBeLessThan(POT.height);
    expect(POT.radius - POT.wall).toBeGreaterThan(BEAD.radius);
    expect(POT.x - POT.radius).toBeGreaterThan(BOARD.length / 2);
  });

  it("flies peeled beads more than a bead width apart", () => {
    expect((BEAD.pitch / STACK_SPEED) * FLIGHT_SPEED).toBeGreaterThan(
      2 * BEAD.radius
    );
  });

  it("gives every leg a shortest time and slows a longer leg in proportion", () => {
    expect(legDuration(0)).toBeCloseTo(0.18, 10);
    expect(legDuration(-0.1)).toBeCloseTo(legDuration(0.1), 10);
    expect(legDuration(0.25)).toBeCloseTo(0.68, 10);
  });

  it("eases from rest to rest, clamped outside the leg", () => {
    expect(ease(-1)).toBe(0);
    expect(ease(0)).toBe(0);
    expect(ease(0.5)).toBe(0.5);
    expect(ease(1)).toBe(1);
    expect(ease(2)).toBe(1);
  });
});
