// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  needsRedraw,
  printBudget,
  printPixels,
  screenDensity,
} from "@repo/design-system/components/three/print/sharp";

describe("what a stage tier spares for print", () => {
  it("gives a capable device the largest image and the phone tiers less", () => {
    expect(printBudget("full")).toEqual({
      anisotropy: 16,
      around: 64,
      limit: 2048,
    });
    expect(printBudget("light").limit).toBe(2048);
    expect(printBudget("low")).toEqual({
      anisotropy: 4,
      around: 40,
      limit: 1024,
    });
    expect(printBudget("plain").limit).toBe(1024);
  });
});

describe("how many pixels a metre of print covers", () => {
  it("is the buffer's height over the height of the view at the print", () => {
    // A 90 degree lens sees 2 m of height from 1 m away.
    expect(
      screenDensity({ distance: 1, fov: 90, kind: "perspective" }, 1000, 1)
    ).toBeCloseTo(500);
  });

  it("triples when the reader comes three times closer, and follows the scene's scale", () => {
    const far = screenDensity(
      { distance: 0.9, fov: 37, kind: "perspective" },
      1080,
      1
    );
    const near = screenDensity(
      { distance: 0.3, fov: 37, kind: "perspective" },
      1080,
      2
    );
    expect(near / far).toBeCloseTo(6);
  });

  it("has no bound for a print the camera stands on", () => {
    expect(
      screenDensity({ distance: 0, fov: 37, kind: "perspective" }, 1080, 1)
    ).toBe(Number.POSITIVE_INFINITY);
  });

  it("is the zoom of a parallel camera", () => {
    expect(screenDensity({ kind: "orthographic", zoom: 400 }, 1080, 0.5)).toBe(
      200
    );
  });
});

describe("the image a print is drawn into", () => {
  it("takes the next power of two at or above what the screen shows", () => {
    // A dial 88 mm across seen at 5340 px per metre covers 470 px.
    expect(printPixels({ height: 0.088, width: 0.088 }, 5340, 2048)).toEqual({
      height: 512,
      width: 512,
    });
  });

  it("keeps the shorter side in proportion, so a pixel is square on the object", () => {
    expect(printPixels({ height: 0.028, width: 0.0622 }, 9000, 2048)).toEqual({
      height: 461,
      width: 1024,
    });
  });

  it("never asks for more than the tier spares, however close the reader comes", () => {
    expect(
      printPixels({ height: 0.1, width: 0.2 }, Number.POSITIVE_INFINITY, 1024)
    ).toEqual({ height: 512, width: 1024 });
  });

  it("draws at least a small image before the print is seen at all", () => {
    expect(printPixels({ height: 0.1, width: 0.1 }, 0, 2048)).toEqual({
      height: 64,
      width: 64,
    });
    expect(printPixels({ height: 0.0001, width: 0.5 }, 0, 2048).height).toBe(1);
  });
});

describe("when a print is drawn again", () => {
  const drawn = { height: 512, width: 512 };

  it("is drawn larger as soon as the reader sees it larger", () => {
    expect(needsRedraw(drawn, { height: 1024, width: 1024 })).toBe(true);
    expect(needsRedraw(drawn, { height: 600, width: 512 })).toBe(true);
  });

  it("keeps its image while the reader zooms out a little", () => {
    expect(needsRedraw(drawn, drawn)).toBe(false);
    expect(needsRedraw(drawn, { height: 256, width: 256 })).toBe(false);
  });

  it("gives its memory back once it is four times too large", () => {
    expect(needsRedraw(drawn, { height: 128, width: 128 })).toBe(true);
  });
});
