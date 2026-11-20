// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  bandPath,
  boxOnTray,
  boxPack,
  boxPanels,
  boxSize,
  bundleInBox,
  bundlePack,
  bundleSize,
  HEAP,
  heapRadius,
  heapSticks,
  STICK,
  stickInBundle,
  trayPanels,
  traySize,
} from "@repo/design-system/components/contents/mathematics/bundle/layout";
import { Array as Arr } from "effect";

const BASES = Arr.range(2, 9);

describe("bundle layout", () => {
  it("packs every base into squat bundles and boxes with a near-square end", () => {
    for (const base of BASES) {
      const bundle = bundlePack(base);
      const box = boxPack(base);
      expect(bundle.columns * bundle.layers).toBeGreaterThanOrEqual(base);
      expect(bundle.layers).toBeLessThanOrEqual(5);
      expect(box.columns * box.layers).toBeGreaterThanOrEqual(base);
      expect((box.columns - 1) * box.layers).toBeLessThan(base);
      const end = boxSize(base);
      expect(end.height / end.depth).toBeLessThan(2);
      expect(end.depth / end.height).toBeLessThan(2);
    }
    expect(bundlePack(9)).toEqual({ columns: 2, layers: 5 });
    expect(boxPack(2)).toEqual({ columns: 1, layers: 2 });
    expect(boxPack(5)).toEqual({ columns: 2, layers: 3 });
    expect(boxPack(8)).toEqual({ columns: 2, layers: 4 });
  });

  it("keeps every stick inside its bundle", () => {
    for (const base of BASES) {
      const size = bundleSize(base);
      for (const slot of Arr.range(0, base - 1)) {
        const at = stickInBundle(slot, base);
        expect(Math.abs(at.z) + STICK.width / 2).toBeLessThanOrEqual(
          size.depth / 2
        );
        expect(at.y + STICK.thickness).toBeLessThanOrEqual(size.height);
      }
    }
  });

  it("keeps every bundle inside its box and every box on its tray", () => {
    for (const base of BASES) {
      const bundle = bundleSize(base);
      const box = boxSize(base);
      const tray = traySize(base);
      expect(box.length).toBeGreaterThan(bundle.length);
      expect(tray.length).toBeGreaterThan(box.length);
      for (const slot of Arr.range(0, base - 1)) {
        const inBox = bundleInBox(slot, base);
        expect(Math.abs(inBox.z) + bundle.depth / 2).toBeLessThan(
          box.depth / 2
        );
        expect(inBox.y + bundle.height).toBeLessThanOrEqual(box.height);
        const onTray = boxOnTray(slot, base);
        expect(Math.abs(onTray.z) + box.depth / 2).toBeLessThan(tray.depth / 2);
        expect(onTray).toMatchObject({ x: 0, y: boxOnTray(0, base).y });
        expect(onTray.y).toBeGreaterThan(0);
        expect(onTray.y + box.height).toBeGreaterThan(tray.height);
      }
    }
  });

  it("tips the same low round heap for every learner", () => {
    const heap = heapSticks(120, 7);
    expect(heap).toHaveLength(120);
    expect(heapSticks(120, 7)).toEqual(heap);
    const radius = heapRadius(120);
    expect(heapRadius(300)).toBeGreaterThan(radius);
    for (const stick of heap) {
      expect(
        Math.hypot(stick.x - HEAP.x, stick.z - HEAP.z)
      ).toBeLessThanOrEqual(radius);
      expect(stick.y).toBeGreaterThanOrEqual(0);
      expect(Math.abs(stick.tilt)).toBeLessThanOrEqual(0.06);
      expect(stick.yaw).toBeGreaterThanOrEqual(0);
      expect(stick.yaw).toBeLessThan(Math.PI);
    }
  });

  it("builds an open box and an open tray from a floor and four walls", () => {
    for (const base of BASES) {
      const box = boxSize(base);
      const panels = boxPanels(base);
      expect(panels).toHaveLength(5);
      const [floor] = panels;
      expect(floor?.size).toEqual([box.length, 0.0012, box.depth]);
      for (const panel of panels) {
        expect(Math.abs(panel.at.x) + panel.size[0] / 2).toBeLessThanOrEqual(
          box.length / 2 + 1e-9
        );
        expect(Math.abs(panel.at.z) + panel.size[2] / 2).toBeLessThanOrEqual(
          box.depth / 2 + 1e-9
        );
        expect(panel.at.y + panel.size[1] / 2).toBeLessThanOrEqual(
          box.height + 1e-9
        );
      }
      expect(trayPanels(base)).toHaveLength(5);
    }
  });

  it("winds a rubber band just round the bundle's middle", () => {
    for (const base of BASES) {
      const size = bundleSize(base);
      const path = bandPath(base, 6);
      expect(path).toHaveLength(24);
      for (const point of path) {
        const outside =
          Math.abs(point.z) >= size.depth / 2 - 1e-9 ||
          point.y >= size.height - 1e-9 ||
          point.y <= 1e-9;
        expect(outside).toBe(true);
        expect(Math.abs(point.z)).toBeLessThanOrEqual(size.depth / 2 + 0.0005);
        expect(point.x).toBe(0);
      }
    }
  });
});
