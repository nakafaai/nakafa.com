// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { idOf } from "@repo/backend/confect/island/blocks";
import { Array as Arr, MutableHashSet, Result } from "effect";
import { ATLAS_TILES } from "@/lib/island/atlas";
import { groundOf, groundTopSlot } from "@/lib/island/ground";
import { lightingOf, meshChunk, STRIDE } from "@/lib/island/mesh";
import { terrainOf } from "@/lib/island/terrain";
import { cellOf, emptyCells } from "@/lib/island/world";

/** The number of quads in a draw list. */
const quadsOf = (list: ReturnType<typeof meshChunk>["solid"]) =>
  list.indices.length / 6;

describe("island/mesh", () => {
  it("grows a tuft on about two in five grass tops under open air, and none on a covered top or on soil", () => {
    /** A chunk of one block across at height 8, with `over` on top of every column. */
    const field = (block: "grass" | "dirt", over = 0) => {
      const cells = emptyCells();
      for (const cell of Arr.makeBy(16 * 16, (index) => index)) {
        cells[cellOf(cell % 16, 8, Math.floor(cell / 16))] = idOf(block);
        cells[cellOf(cell % 16, 9, Math.floor(cell / 16))] = over;
      }
      return meshChunk(cells, lightingOf(cells), 0, 0).tufts;
    };
    // A tuft is a cross of four quads, standing in the air over its top.
    const meadow = field("grass");
    const tufts = quadsOf(meadow) / 4;
    expect(tufts).toBeGreaterThan(256 * 0.25);
    expect(tufts).toBeLessThan(256 * 0.55);
    const heights = Arr.makeBy(
      meadow.vertices.length / STRIDE,
      (vertex) => meadow.vertices[vertex * STRIDE + 1]
    );
    expect(Math.min(...heights)).toBe(9);
    expect(Math.max(...heights)).toBe(10);
    expect(quadsOf(field("grass", idOf("stone")))).toBe(0);
    expect(quadsOf(field("dirt"))).toBe(0);
  });

  it("draws all six faces of a lone block, and none of the faces two blocks share", () => {
    const cells = emptyCells();
    cells[cellOf(5, 10, 5)] = idOf("stone");
    expect(quadsOf(meshChunk(cells, lightingOf(cells), 0, 0).solid)).toBe(6);
    cells[cellOf(6, 10, 5)] = idOf("stone");
    cells[cellOf(0, 10, 0)] = idOf("stone");
    expect(quadsOf(meshChunk(cells, lightingOf(cells), 0, 0).solid)).toBe(16);
    cells[cellOf(0, 10, 0)] = 0;
    const pair = meshChunk(cells, lightingOf(cells), 0, 0);
    expect(quadsOf(pair.solid)).toBe(10);
    expect(pair.solid.vertices.length).toBe(10 * 4 * STRIDE);
  });

  it("darkens the corners a neighbour crowds, and leaves the light's direction to the sun", () => {
    const cells = emptyCells();
    cells[cellOf(5, 10, 5)] = idOf("stone");
    cells[cellOf(6, 11, 5)] = idOf("stone");
    const { vertices } = meshChunk(cells, lightingOf(cells), 0, 0).solid;
    const shades = Arr.makeBy(vertices.length / STRIDE, (vertex) =>
      Math.round(vertices[vertex * STRIDE + 5] * 100)
    );
    expect(Math.min(...shades)).toBeLessThan(100);
    expect(Math.max(...shades)).toBe(100);
    // A face is as bright as its corners' occlusion lets it; which way it faces is the sun's to light (D43).
    expect(
      Arr.every(shades, (shade) => Arr.contains([50, 68, 84, 100], shade))
    ).toBe(true);
  });

  it("lets the wind take a crown by how far each corner is from wood, and never tears it", () => {
    const cells = emptyCells();
    // A trunk of two logs with a crown of leaves over and beside it, four blocks along x.
    cells[cellOf(5, 9, 5)] = idOf("log");
    cells[cellOf(5, 10, 5)] = idOf("log");
    for (const x of [5, 6, 7, 8, 9]) {
      cells[cellOf(x, 11, 5)] = idOf("leaves");
    }
    const { vertices } = meshChunk(cells, lightingOf(cells), 0, 0).solid;
    /** Every wind weight the corners at one place carry, whichever block and face they belong to. */
    const swaysAt = (x: number, y: number, z: number) =>
      Arr.dedupe(
        Arr.filterMap(
          Arr.makeBy(vertices.length / STRIDE, (vertex) => vertex * STRIDE),
          (at) =>
            vertices[at] === x &&
            vertices[at + 1] === y &&
            vertices[at + 2] === z
              ? Result.succeed(vertices[at + 8])
              : Result.failVoid
        )
      );
    // Held where the crown sits on the trunk, half free a block out, free beyond.
    expect(swaysAt(5, 11, 5)).toEqual([0]);
    expect(swaysAt(6, 11, 5)).toEqual([0]);
    expect(swaysAt(7, 11, 5)).toEqual([0.5]);
    expect(swaysAt(7, 12, 5)).toEqual([0.5]);
    expect(swaysAt(8, 12, 5)).toEqual([1]);
    expect(swaysAt(10, 12, 6)).toEqual([1]);
    // The trunk itself never moves.
    expect(swaysAt(5, 9, 5)).toEqual([0]);
  });

  it("draws a ground top from its Wang set by its edges, holds it still, and lets a flower go at its top only", () => {
    const cells = emptyCells();
    cells[cellOf(5, 10, 5)] = idOf("grass");
    cells[cellOf(5, 11, 5)] = idOf("flowers");
    const { vertices } = meshChunk(cells, lightingOf(cells), 0, 0).solid;
    const corners = Arr.makeBy(vertices.length / STRIDE, (vertex) => ({
      slot:
        Math.floor(vertices[vertex * STRIDE + 3] * ATLAS_TILES) +
        Math.floor(vertices[vertex * STRIDE + 4] * ATLAS_TILES) * ATLAS_TILES,
      sway: vertices[vertex * STRIDE + 8],
      y: vertices[vertex * STRIDE + 1],
    }));
    // The grass's top face, which a flower lets show, draws its set's tile for the marks of its edges.
    const grassTop = groundTopSlot(groundOf(idOf("grass")), 5, 5);
    expect(
      Arr.filter(corners, ({ slot, y }) => y === 11 && slot === grassTop)
    ).toHaveLength(4);
    expect(
      Arr.dedupe(
        Arr.map(
          Arr.filter(corners, ({ sway }) => sway > 0),
          ({ y }) => y
        )
      )
    ).toEqual([12]);
    expect(Arr.some(corners, ({ sway }) => sway < 0)).toBe(false);
  });

  it("puts water in its own pass, its open surface sunk below the cell's top", () => {
    const cells = emptyCells();
    cells[cellOf(3, 4, 3)] = idOf("water");
    cells[cellOf(4, 4, 3)] = idOf("water");
    cells[cellOf(3, 5, 3)] = idOf("water");
    const mesh = meshChunk(cells, lightingOf(cells), 0, 0);
    expect(quadsOf(mesh.solid)).toBe(0);
    const heights = MutableHashSet.fromIterable(
      Arr.makeBy(
        mesh.water.vertices.length / STRIDE,
        (vertex) => mesh.water.vertices[vertex * STRIDE + 1]
      )
    );
    expect(MutableHashSet.has(heights, 4.875)).toBe(true);
    expect(MutableHashSet.has(heights, 6)).toBe(false);
    expect(MutableHashSet.has(heights, 5.875)).toBe(true);
  });

  it("draws no wall of water at the world's edge, where the open sea goes on", () => {
    const cells = emptyCells();
    cells[cellOf(0, 4, 5)] = idOf("water");
    // Top, east, north, south and bottom show; the west face would stand on the edge.
    expect(quadsOf(meshChunk(cells, lightingOf(cells), 0, 0).water)).toBe(5);
  });

  it("draws a flower patch as two crossed planes seen from both sides, a plant of the catalog not at all (its model does), and glass beside glass with no face between", () => {
    const cells = emptyCells();
    cells[cellOf(2, 9, 2)] = idOf("flowers");
    cells[cellOf(4, 9, 4)] = idOf("rose");
    cells[cellOf(8, 9, 8)] = idOf("glass");
    cells[cellOf(9, 9, 8)] = idOf("glass");
    expect(quadsOf(meshChunk(cells, lightingOf(cells), 0, 0).solid)).toBe(
      4 + 10
    );
  });

  it("dims faces under a roof and lights faces beside a lamp", () => {
    const cells = emptyCells();
    cells[cellOf(5, 9, 5)] = idOf("stone");
    cells[cellOf(5, 12, 5)] = idOf("planks");
    const glow = new Uint8Array(cells.length);
    glow[cellOf(5, 10, 5)] = 15;
    const { vertices } = meshChunk(cells, lightingOf(cells, glow), 0, 0).solid;
    const tops = Arr.map(
      Arr.filter(
        Arr.makeBy(vertices.length / STRIDE, (vertex) => vertex * STRIDE),
        (at) => vertices[at + 1] === 10
      ),
      (at) => [Math.round(vertices[at + 6] * 100) / 100, vertices[at + 7]]
    );
    expect(tops).toContainEqual([0.35, 1]);
  });

  it("meshes a whole chunk of generated land", () => {
    const cells = terrainOf(2, 32);
    const mesh = meshChunk(cells, lightingOf(cells), 1, 1);
    expect(quadsOf(mesh.solid)).toBeGreaterThan(256);
    expect(quadsOf(mesh.water)).toBeGreaterThan(0);
    expect(mesh.solid.vertices.length).toBe(
      (mesh.solid.indices.length / 6) * 4 * STRIDE
    );
  });
});
