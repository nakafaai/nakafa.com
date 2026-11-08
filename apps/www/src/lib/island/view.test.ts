import { describe, expect, it } from "@effect/vitest";
import { Vector3 } from "three";
import {
  artPixelFor,
  bufferFor,
  cameraFor,
  DEFAULT_ART_PIXEL,
  PIXELS_PER_UNIT,
  zoomed,
} from "@/lib/island/view";

describe("island view", () => {
  it("draws one cell eight art pixels along a grid axis", () => {
    expect(PIXELS_PER_UNIT * Math.cos(Math.PI / 4)).toBeCloseTo(8);
  });

  it("keeps the default art pixel when the island fits and shrinks it in whole steps when not", () => {
    expect(artPixelFor(1440, 900, 6)).toBe(DEFAULT_ART_PIXEL);
    expect(artPixelFor(390, 390, 6)).toBe(2);
    expect(artPixelFor(600, 500, 8)).toBe(2);
    expect(artPixelFor(100, 100, 24)).toBe(1);
  });

  it("zooms one whole art pixel at a time within its bounds", () => {
    expect(zoomed(3, 1)).toBe(4);
    expect(zoomed(1, -1)).toBe(1);
    expect(zoomed(6, 1)).toBe(6);
  });

  it("sizes the buffer in an even number of whole art pixels", () => {
    expect(bufferFor(1001, 700, 3)).toEqual({
      columns: 332,
      cssHeight: 696,
      cssWidth: 996,
      rows: 232,
    });
    expect(bufferFor(1, 1, 3)).toMatchObject({ columns: 2, rows: 2 });
  });

  it("frames the island at one art pixel per buffer pixel with its origin on a pixel corner", () => {
    const camera = cameraFor(6, 200, 100);
    expect(camera).toMatchObject({ far: 120, manual: true, near: 1 });
    const pixelOf = (x: number, y: number, z: number) => {
      const point = new Vector3(x, y, z).project(camera);
      return { across: point.x * 100, up: point.y * 50 };
    };
    const origin = pixelOf(0, 0, 0);
    expect(origin.across).toBeCloseTo(Math.round(origin.across), 6);
    expect(origin.up).toBeCloseTo(Math.round(origin.up), 6);
    const step = pixelOf(1, 0, 0);
    expect(step.across - origin.across).toBeCloseTo(8, 6);
    expect(step.up - origin.up).toBeCloseTo(-4, 6);
    const middle = pixelOf(3, -0.9, 3);
    expect(Math.abs(middle.across)).toBeLessThan(0.5);
    expect(Math.abs(middle.up)).toBeLessThan(0.5);
  });
});
