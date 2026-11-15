// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { SPAN } from "@repo/backend/confect/island/world";
import {
  clampOrbit,
  DISTANCE,
  easeOrbit,
  eyeOf,
  FIELD_OF_VIEW,
  openingOrbit,
  PITCH,
  panOrbit,
  snapOrbit,
  turnOrbit,
  zoomOrbit,
} from "@/lib/island/camera";

describe("island/camera", () => {
  it("opens over the middle of the island, farther for a wider one", () => {
    const small = openingOrbit(10, 1.5);
    expect(small.target).toEqual([SPAN / 2, 9, SPAN / 2]);
    expect(openingOrbit(64, 1.5).distance).toBeGreaterThan(small.distance);
    expect(openingOrbit(16, 0.5).distance).toBeGreaterThan(small.distance);
    const eye = eyeOf(small);
    expect(eye[1]).toBeGreaterThan(small.target[1]);
    expect(Math.hypot(eye[0] - 32, eye[1] - 9, eye[2] - 32)).toBeCloseTo(
      small.distance
    );
  });

  it("keeps the camera within its distance, its tilt, and over the world", () => {
    const wild = clampOrbit({
      distance: 1,
      pitch: 3,
      target: [-5, 99, 900],
      yaw: 7,
    });
    expect(wild).toEqual({
      distance: DISTANCE.near,
      pitch: PITCH.high,
      target: [0, 32, SPAN],
      yaw: 7,
    });
    expect(zoomOrbit(openingOrbit(16, 1.5), 100).distance).toBe(DISTANCE.far);
  });

  it("drags the ground with the finger: right moves the view left, down moves it away", () => {
    const orbit = {
      distance: 40,
      pitch: 0.7,
      target: [32, 9, 32] as const,
      yaw: 0,
    };
    const right = panOrbit(orbit, 100, 0, 800);
    expect(right.target[0]).toBeLessThan(32);
    expect(right.target[2]).toBeCloseTo(32);
    const down = panOrbit(orbit, 0, 100, 800);
    expect(down.target[2]).toBeLessThan(32);
  });

  it("turns and tilts, and eases the short way round", () => {
    const orbit = openingOrbit(24, 1.5);
    const turned = turnOrbit(orbit, 0.5, 0.1);
    expect(turned.yaw).toBeCloseTo(orbit.yaw + 0.5);
    expect(turned.pitch).toBeCloseTo(orbit.pitch + 0.1);
    expect(turnOrbit(orbit, 0.5).pitch).toBe(orbit.pitch);
    const from = { ...orbit, yaw: 0.1 };
    const to = {
      ...orbit,
      distance: orbit.distance * 2,
      yaw: Math.PI * 2 - 0.1,
    };
    const half = easeOrbit(from, to, 0.5);
    expect(half.yaw).toBeCloseTo(0);
    expect(half.distance).toBeCloseTo(orbit.distance * 1.5);
  });

  it("snaps the target to whole art pixels across the screen, keeps its depth, and says what it rounded away", () => {
    const orbit = {
      distance: 40,
      pitch: 0.7,
      target: [20.37, 9, 31.81] as const,
      yaw: 0.9,
    };
    const rows = 270;
    const { orbit: snapped, shift } = snapOrbit(orbit, rows);
    const pixel = (2 * orbit.distance * Math.tan(FIELD_OF_VIEW / 2)) / rows;
    const dot = (a: readonly number[], b: readonly number[]) =>
      a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const right = [Math.cos(0.9), 0, -Math.sin(0.9)];
    const up = [
      -Math.sin(0.7) * Math.sin(0.9),
      Math.cos(0.7),
      -Math.sin(0.7) * Math.cos(0.9),
    ];
    const ahead = [
      Math.cos(0.7) * Math.sin(0.9),
      Math.sin(0.7),
      Math.cos(0.7) * Math.cos(0.9),
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
});
