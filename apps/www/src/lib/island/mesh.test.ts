// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { idOf } from "@repo/backend/confect/island/blocks";
import { SPAN } from "@repo/backend/confect/island/world";
import { Array as Arr, MutableHashSet } from "effect";
import { lightingOf, meshChunk, STRIDE, skylineOf } from "@/lib/island/mesh";
import { terrainOf } from "@/lib/island/terrain";
import { cellOf, emptyCells } from "@/lib/island/world";

/** The number of quads in a draw list. */
const quadsOf = (list: ReturnType<typeof meshChunk>["solid"]) =>
  list.indices.length / 6;

describe("island/mesh", () => {
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

  it("darkens the corners a neighbour crowds, and shades the bottom darker than the top", () => {
    const cells = emptyCells();
    cells[cellOf(5, 10, 5)] = idOf("stone");
    cells[cellOf(6, 11, 5)] = idOf("stone");
    const { vertices } = meshChunk(cells, lightingOf(cells), 0, 0).solid;
    const shades = Arr.makeBy(vertices.length / STRIDE, (vertex) =>
      Math.round(vertices[vertex * STRIDE + 5] * 100)
    );
    expect(Math.min(...shades)).toBeLessThan(55);
    expect(Math.max(...shades)).toBe(100);
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

  it("meshes a whole chunk of generated land, and reads the skyline of every column", () => {
    const cells = terrainOf(2, 32);
    const mesh = meshChunk(cells, lightingOf(cells), 1, 1);
    expect(quadsOf(mesh.solid)).toBeGreaterThan(256);
    expect(quadsOf(mesh.water)).toBeGreaterThan(0);
    expect(mesh.solid.vertices.length).toBe(
      (mesh.solid.indices.length / 6) * 4 * STRIDE
    );
    const skyline = skylineOf(emptyCells());
    expect(skyline[0]).toBe(-1);
    expect(
      skylineOf(cells)[(SPAN / 2) * SPAN + SPAN / 2]
    ).toBeGreaterThanOrEqual(8);
  });
});
