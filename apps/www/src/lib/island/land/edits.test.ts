// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { MutableHashMap } from "effect";
import { keyOf, LIFT_STEPS, PAINT } from "@/lib/island/land/chunk";
import {
  clearedOf,
  LIFT_LIMIT,
  liftOf,
  paintOf,
  setCleared,
  setLift,
  setPaint,
} from "@/lib/island/land/edits";
import { coverAt, depthAt, heightAt, landOf } from "@/lib/island/land/ground";
import { homeOf } from "@/lib/island/land/home";

const SEED = 4242;

/** The lattice point every world of the seed opens on: dry, open, level ground. */
const [HOME_I, HOME_J] = homeOf(SEED);

describe("island/land/edits", () => {
  it("reads untouched land as not moved, not painted and not cleared", () => {
    const land = landOf(SEED);
    expect(liftOf(land, -70, 3)).toBe(0);
    expect(paintOf(land, -70, 3)).toBe(PAINT.none);
    expect(clearedOf(land, -70, 3)).toBe(false);
    expect(MutableHashMap.size(land.lifts)).toBe(0);
  });

  it("moves the ground by eighths of a block, in the made chunk and in what the world stores", () => {
    const land = landOf(SEED);
    const before = heightAt(land, 40, -9);
    setLift(land, 40, -9, 12);
    expect(liftOf(land, 40, -9)).toBe(12);
    expect(heightAt(land, 40, -9)).toBeCloseTo(before + 12 / LIFT_STEPS, 5);
    setLift(land, 40, -9, -8);
    expect(liftOf(land, 40, -9)).toBe(-8);
    expect(heightAt(land, 40, -9)).toBeCloseTo(before - 1, 5);
    expect(liftOf(land, 41, -9)).toBe(0);
    expect(MutableHashMap.has(land.lifts, keyOf(1, -1))).toBe(true);
  });

  it("holds a lift to whole eighths and to as far as a world stores", () => {
    const land = landOf(SEED);
    const before = heightAt(land, 3, 3);
    setLift(land, 3, 3, 300);
    expect(liftOf(land, 3, 3)).toBe(LIFT_LIMIT);
    expect(heightAt(land, 3, 3)).toBeCloseTo(
      before + LIFT_LIMIT / LIFT_STEPS,
      4
    );
    setLift(land, 3, 3, -300);
    expect(liftOf(land, 3, 3)).toBe(-LIFT_LIMIT);
    setLift(land, 3, 3, 2.4);
    expect(liftOf(land, 3, 3)).toBe(2);
    expect(heightAt(land, 3, 3)).toBeCloseTo(before + 2 / LIFT_STEPS, 4);
  });

  it("keeps a lift when its chunk is forgotten and made again", () => {
    const land = landOf(SEED);
    const before = heightAt(land, 5, 5);
    setLift(land, 5, 5, 16);
    MutableHashMap.clear(land.chunks);
    expect(heightAt(land, 5, 5)).toBeCloseTo(before + 2, 5);
  });

  it("paints one surface over another, and gives the land its own back", () => {
    const land = landOf(SEED);
    const own = coverAt(land, HOME_I, HOME_J);
    expect(own).not.toBe("path");
    setPaint(land, HOME_I, HOME_J, PAINT.path);
    expect(paintOf(land, HOME_I, HOME_J)).toBe(PAINT.path);
    expect(coverAt(land, HOME_I, HOME_J)).toBe("path");
    setPaint(land, HOME_I, HOME_J, PAINT.sand);
    expect(coverAt(land, HOME_I, HOME_J)).toBe("sand");
    setPaint(land, HOME_I, HOME_J, PAINT.meadow);
    expect(coverAt(land, HOME_I, HOME_J)).toBe("meadow");
    setPaint(land, HOME_I, HOME_J, PAINT.none);
    expect(paintOf(land, HOME_I, HOME_J)).toBe(PAINT.none);
    expect(coverAt(land, HOME_I, HOME_J)).toBe(own);
  });

  it("digs a pond that holds water, and grows the ground back when it is painted over", () => {
    const land = landOf(SEED);
    const before = heightAt(land, HOME_I, HOME_J);
    expect(depthAt(land, HOME_I, HOME_J)).toBeLessThan(0);
    setPaint(land, HOME_I, HOME_J, PAINT.pond);
    expect(depthAt(land, HOME_I, HOME_J)).toBeGreaterThan(0.5);
    expect(heightAt(land, HOME_I, HOME_J)).toBeLessThan(before - 0.5);
    setPaint(land, HOME_I, HOME_J, PAINT.grass);
    expect(heightAt(land, HOME_I, HOME_J)).toBeCloseTo(before, 5);
    expect(depthAt(land, HOME_I, HOME_J)).toBeLessThan(0);
    expect(coverAt(land, HOME_I, HOME_J)).toBe("grass");
  });

  it("shows a pond dug through a painted surface as it will read when the chunk is made again", () => {
    const land = landOf(SEED);
    setPaint(land, HOME_I, HOME_J, PAINT.path);
    setPaint(land, HOME_I, HOME_J, PAINT.pond);
    const shown = coverAt(land, HOME_I, HOME_J);
    const deep = depthAt(land, HOME_I, HOME_J);
    MutableHashMap.clear(land.chunks);
    expect(shown).toBe(coverAt(land, HOME_I, HOME_J));
    expect(shown).not.toBe("path");
    expect(depthAt(land, HOME_I, HOME_J)).toBeCloseTo(deep, 5);
  });

  it("keeps a lift under a pond that is filled in again", () => {
    const land = landOf(SEED);
    const before = heightAt(land, HOME_I, HOME_J);
    setLift(land, HOME_I, HOME_J, 8);
    setPaint(land, HOME_I, HOME_J, PAINT.pond);
    setPaint(land, HOME_I, HOME_J, PAINT.none);
    expect(heightAt(land, HOME_I, HOME_J)).toBeCloseTo(before + 1, 5);
  });

  it("clears a wild plant's lattice point and lets it grow back, a chunk's points in one store", () => {
    const land = landOf(SEED);
    setCleared(land, -4, 70, true);
    setCleared(land, -5, 70, true);
    expect(clearedOf(land, -4, 70)).toBe(true);
    expect(clearedOf(land, -6, 70)).toBe(false);
    setCleared(land, -4, 70, false);
    expect(clearedOf(land, -4, 70)).toBe(false);
    expect(clearedOf(land, -5, 70)).toBe(true);
    expect(MutableHashMap.size(land.clears)).toBe(1);
  });
});
