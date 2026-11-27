import { describe, expect, it } from "@effect/vitest";
import type { Lamina } from "@repo/design-system/components/three/flora/mesophyll";
import {
  BLOB_STRIDE,
  growLamina,
  LAYERS,
} from "@repo/design-system/components/three/flora/mesophyll";
import { Array as Arr } from "effect";

/** A block of leaf blade with a vein through its middle and a stoma to one side. */
const BLOCK: Lamina = {
  depth: 0.8,
  seed: 3,
  stoma: 0.4,
  vein: 0.2,
  width: 1.64,
};

/** The cells of one tissue as a record each. */
function cellsOf(blobs: readonly number[]) {
  return Arr.map(Arr.chunksOf(blobs, BLOB_STRIDE), (blob) => ({
    deep: Number(blob[5]),
    tall: Number(blob[4]),
    wide: Number(blob[3]),
    x: Number(blob[0]),
    y: Number(blob[1]),
    z: Number(blob[2]),
  }));
}

describe("growLamina", () => {
  const leaf = growLamina(BLOCK);

  it("stacks the layers of the blade in their order from the lower face up", () => {
    const middle = (blobs: readonly number[]) =>
      Arr.reduce(cellsOf(blobs), 0, (sum, cell) => sum + cell.y) /
      (blobs.length / BLOB_STRIDE);

    expect(middle(leaf.lower)).toBeGreaterThan(LAYERS.lower);
    expect(middle(leaf.spongy)).toBeGreaterThan(middle(leaf.lower));
    expect(middle(leaf.palisade)).toBeGreaterThan(middle(leaf.spongy));
    expect(middle(leaf.upper)).toBeGreaterThan(middle(leaf.palisade));
    expect(middle(leaf.upper)).toBeLessThan(LAYERS.cuticle);
  });

  it("keeps every cell of the epidermis and the mesophyll inside the block", () => {
    for (const cell of cellsOf([
      ...leaf.upper,
      ...leaf.lower,
      ...leaf.palisade,
    ])) {
      expect(Math.abs(cell.x) + cell.wide / 2).toBeLessThanOrEqual(
        BLOCK.width / 2 + 1e-9
      );
      expect(Math.abs(cell.z) + cell.deep / 2).toBeLessThanOrEqual(
        BLOCK.depth / 2 + 1e-9
      );
    }
  });

  it("stands the palisade cells on end and shortens them over the vein", () => {
    const columns = cellsOf(leaf.palisade);
    const clear = Arr.filter(columns, (cell) => Math.abs(cell.x) > 0.4);
    const over = Arr.filter(columns, (cell) => Math.abs(cell.x) < 0.1);

    for (const cell of clear) {
      expect(cell.tall).toBeGreaterThan(3 * cell.wide);
    }
    expect(Number(over[0]?.tall)).toBeLessThan(Number(clear[0]?.tall));
  });

  it("leaves air in the spongy layer, none of its cells in the vein or over the stoma", () => {
    const sponge = cellsOf(leaf.spongy);

    expect(sponge.length).toBeLessThan(13 * 3 * 6);
    expect(sponge.length).toBeGreaterThan(100);
    for (const cell of sponge) {
      expect(Math.hypot(cell.x, cell.y - LAYERS.vein)).toBeGreaterThanOrEqual(
        BLOCK.vein + 0.07
      );
      expect(
        Math.abs(cell.x - BLOCK.stoma) < 0.13 &&
          cell.y < LAYERS.spongy + 0.17 &&
          cell.z > BLOCK.depth / 2 - 0.3
      ).toBe(false);
    }
  });

  it("opens the lower epidermis at the cut face for a pair of guard cells", () => {
    const guards = cellsOf(leaf.guards);
    const front = Arr.filter(
      cellsOf(leaf.lower),
      (cell) => cell.z > BLOCK.depth / 2 - 0.1
    );

    expect(guards).toHaveLength(2);
    expect(leaf.lower.length).toBeLessThan(leaf.upper.length);
    for (const cell of front) {
      expect(Math.abs(cell.x - BLOCK.stoma)).toBeGreaterThanOrEqual(0.1);
    }
    expect(Number(guards[0]?.x)).toBeLessThan(BLOCK.stoma);
    expect(Number(guards[1]?.x)).toBeGreaterThan(BLOCK.stoma);
  });

  it("runs the vein through the block with xylem above phloem inside a sheath", () => {
    const xylem = cellsOf(leaf.xylem);
    const phloem = cellsOf(leaf.phloem);
    const bores = cellsOf(leaf.bores);

    expect(cellsOf(leaf.sheath)).toHaveLength(12);
    for (const vessel of xylem) {
      expect(vessel.y).toBeGreaterThan(LAYERS.vein);
      expect(vessel.deep).toBeCloseTo(BLOCK.depth, 1);
    }
    for (const cell of phloem) {
      expect(cell.y).toBeLessThan(LAYERS.vein);
      expect(cell.wide).toBeLessThan(Number(xylem[0]?.wide));
    }
    expect(Number(bores[0]?.wide)).toBeLessThan(Number(xylem[0]?.wide));
    expect(Number(bores[0]?.z) + Number(bores[0]?.deep) / 2).toBeGreaterThan(
      Number(xylem[0]?.z) + Number(xylem[0]?.deep) / 2
    );
  });

  it("packs chloroplasts into the palisade, fewer into the spongy cells, a few into the guard cells", () => {
    const columns = leaf.palisade.length / BLOB_STRIDE;
    const sponge = leaf.spongy.length / BLOB_STRIDE;

    expect(leaf.plastids).toHaveLength(
      (columns * 7 + sponge * 3 + 2 * 4) * BLOB_STRIDE
    );
    for (const plastid of cellsOf(leaf.plastids)) {
      expect(plastid.y).toBeGreaterThan(LAYERS.lower);
      expect(plastid.y).toBeLessThan(LAYERS.upper);
    }
  });
});
