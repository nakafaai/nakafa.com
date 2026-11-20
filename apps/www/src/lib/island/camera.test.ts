// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";
import {
  artPixelFor,
  DISTANCE,
  eyeOf,
  FIELD_OF_VIEW,
  FOG,
  Orbit,
  PITCH,
  snapOrbit,
  YAW_STEP,
} from "@/lib/island/camera";

describe("island/camera", () => {
  it("stands the lens its distance from the target, over it by its tilt and around it by its turn", () => {
    const orbit = {
      distance: 40,
      pitch: PITCH.low,
      target: [32, 9, -12] as const,
      yaw: 0,
    };
    expect(Schema.is(Orbit)(orbit)).toBe(true);
    const eye = eyeOf(orbit);
    expect(Math.hypot(eye[0] - 32, eye[1] - 9, eye[2] + 12)).toBeCloseTo(40, 9);
    expect(eye[0]).toBeCloseTo(32, 9);
    expect(eye[2]).toBeGreaterThan(-12);
    const steep = eyeOf({ ...orbit, pitch: PITCH.high });
    expect(steep[1]).toBeGreaterThan(eye[1]);
    expect(steep[2]).toBeLessThan(eye[2]);
    const turned = eyeOf({ ...orbit, yaw: Math.PI / 2 });
    expect(turned[0]).toBeCloseTo(eye[2] + 12 + 32, 9);
    expect(turned[2]).toBeCloseTo(-12, 9);
    expect(turned[1]).toBe(eye[1]);
    // The air hides the land well past the farthest the lens pulls back, so the world never ends at an edge.
    expect(FOG.to).toBeGreaterThan(DISTANCE.far);
    expect(FOG.from).toBeLessThan(FOG.to);
    expect(DISTANCE.near).toBeLessThan(DISTANCE.far);
  });

  it("snaps the turn to whole steps and the target to whole art pixels across the screen, keeps its depth, and says what it rounded away", () => {
    const orbit = {
      distance: 40,
      pitch: 0.7,
      target: [20.37, 9, 31.81] as const,
      yaw: 52.3 * YAW_STEP,
    };
    const rows = 270;
    const { orbit: snapped, shift } = snapOrbit(orbit, rows);
    const pixel = (2 * orbit.distance * Math.tan(FIELD_OF_VIEW / 2)) / rows;
    const dot = (a: readonly number[], b: readonly number[]) =>
      a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const yaw = 52 * YAW_STEP;
    expect(snapped.yaw).toBeCloseTo(yaw, 12);
    const right = [Math.cos(yaw), 0, -Math.sin(yaw)];
    const up = [
      -Math.sin(0.7) * Math.sin(yaw),
      Math.cos(0.7),
      -Math.sin(0.7) * Math.cos(yaw),
    ];
    const ahead = [
      Math.cos(0.7) * Math.sin(yaw),
      Math.sin(0.7),
      Math.cos(0.7) * Math.cos(yaw),
    ];
    const across = dot(snapped.target, right) / pixel;
    const height = dot(snapped.target, up) / pixel;
    expect(Math.abs(across - Math.round(across))).toBeLessThan(1e-6);
    expect(Math.abs(height - Math.round(height))).toBeLessThan(1e-6);
    expect(dot(snapped.target, ahead)).toBeCloseTo(dot(orbit.target, ahead), 6);
    expect(Math.abs(shift[0])).toBeLessThanOrEqual(0.5);
    expect(shift[0]).toBeCloseTo(across - dot(orbit.target, right) / pixel, 6);
    expect(snapOrbit(snapped, rows).shift[0]).toBeCloseTo(0, 6);
  });

  it("draws a texel at the target at least one art pixel wide at every zoom, never coarser than the screen's art pixel", () => {
    // A 1440 by 900 screen at twice its pixels: its own art pixel is seven device pixels.
    expect(artPixelFor(2880, 1800, 12, 7, false)).toBe(7);
    const opening = artPixelFor(2880, 1800, 60, 7, false);
    expect(opening).toBeLessThan(7);
    expect(artPixelFor(2880, 1800, 170, opening, false)).toBe(1);
    expect(artPixelFor(2880, 1800, 170, 1, true)).toBe(7);
  });

  it("holds the art pixel while a zoom rests near an edge, and changes it once the texel crosses it", () => {
    // At 60 blocks a texel covers about 3.3 device pixels.
    expect(artPixelFor(2880, 1800, 60, 3, false)).toBe(3);
    expect(artPixelFor(2880, 1800, 64, 3, false)).toBe(3);
    expect(artPixelFor(2880, 1800, 80, 3, false)).toBe(2);
  });
});
