// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { MutableHashMap } from "effect";
import { keyOf, LIFT_STEPS, PAINT } from "@/lib/island/land/chunk";
import { clear, level, lift, paint } from "@/lib/island/land/edits";
import { coverAt, depthAt, heightAt, landOf } from "@/lib/island/land/ground";

const SEED = 4242;

describe("island/land/edits", () => {
  it("moves the ground by eighths of a block, in the made chunk and in what the world stores", () => {
    const land = landOf(SEED);
    const before = heightAt(land, 40, -9);
    expect(lift(land, 40, -9, 12)).toBe(12);
    expect(heightAt(land, 40, -9)).toBeCloseTo(before + 12 / LIFT_STEPS, 5);
    expect(lift(land, 40, -9, -20)).toBe(-20);
    expect(heightAt(land, 40, -9)).toBeCloseTo(before - 1, 5);
    expect(MutableHashMap.has(land.lifts, keyOf(1, -1))).toBe(true);
  });

  it("stops moving a point once it is as far from the seed's ground as a world stores", () => {
    const land = landOf(SEED);
    expect(lift(land, 3, 3, 120)).toBe(120);
    expect(lift(land, 3, 3, 40)).toBe(7);
    expect(lift(land, 3, 3, 1)).toBe(0);
    expect(lift(land, 4, 3, -300)).toBe(-127);
  });

  it("keeps a lift when its chunk is forgotten and made again", () => {
    const land = landOf(SEED);
    const before = heightAt(land, 5, 5);
    lift(land, 5, 5, 16);
    MutableHashMap.clear(land.chunks);
    expect(heightAt(land, 5, 5)).toBeCloseTo(before + 2, 5);
  });

  it("paints a surface once, and says when nothing changed", () => {
    const land = landOf(SEED);
    expect(paint(land, 10, 10, PAINT.path)).toBe(true);
    expect(paint(land, 10, 10, PAINT.path)).toBe(false);
    expect(coverAt(land, 10, 10)).toBe("path");
    expect(paint(land, 10, 10, PAINT.sand)).toBe(true);
    expect(coverAt(land, 10, 10)).toBe("sand");
  });

  it("digs a pond, and fills it in again when the learner paints over it", () => {
    const land = landOf(SEED);
    const before = heightAt(land, 20, 20);
    expect(depthAt(land, 20, 20)).toBeLessThan(0);
    paint(land, 20, 20, PAINT.pond);
    expect(depthAt(land, 20, 20)).toBeGreaterThan(0.5);
    paint(land, 20, 20, PAINT.grass);
    expect(heightAt(land, 20, 20)).toBeCloseTo(before, 5);
    expect(depthAt(land, 20, 20)).toBeLessThan(0);
  });

  it("levels the ground under a building to its mean height and eases the rim halfway", () => {
    const land = landOf(SEED);
    const rim = heightAt(land, 29, 31);
    const mean = level(land, [30, 30], [34, 33]);
    for (let j = 30; j <= 33; j += 1) {
      for (let i = 30; i <= 34; i += 1) {
        expect(Math.abs(heightAt(land, i, j) - mean)).toBeLessThanOrEqual(
          0.5 / LIFT_STEPS + 1e-6
        );
      }
    }
    expect(heightAt(land, 29, 31)).toBeCloseTo(
      rim + Math.round(((mean - rim) / 2) * LIFT_STEPS) / LIFT_STEPS,
      5
    );
  });

  it("clears a wild plant's lattice point once", () => {
    const land = landOf(SEED);
    expect(clear(land, -4, 70)).toBe(true);
    expect(clear(land, -4, 70)).toBe(false);
    expect(clear(land, -5, 70)).toBe(true);
    expect(MutableHashMap.size(land.clears)).toBe(1);
  });

  it("answers the ground's own height where a rectangle holds no lattice point", () => {
    const land = landOf(SEED);
    expect(level(land, [50.2, 50.2], [50.8, 50.8])).toBeCloseTo(
      heightAt(land, 50.5, 50.5),
      6
    );
    expect(MutableHashMap.size(land.lifts)).toBe(0);
  });
});
