import type { Shape } from "@/lib/island/voxel";

/** How deep a pond reaches below the grass, in voxels; its water stands two below the grass. */
export const POND_DEPTH = 12;

/** Lily pads that float on a pond's water. */
const LILIES: readonly Shape[] = [
  { _tag: "box", from: [5, 10, 5], ramp: "leaf", tone: 2, to: [7, 10, 6] },
  { _tag: "box", from: [6, 10, 4], ramp: "leaf", tone: 3, to: [6, 10, 4] },
  { _tag: "box", from: [16, 10, 9], ramp: "leaf", tone: 2, to: [18, 10, 11] },
  { _tag: "box", from: [17, 11, 10], ramp: "petal", tone: 2, to: [17, 11, 10] },
  { _tag: "box", from: [9, 10, 15], ramp: "leaf", tone: 2, to: [10, 10, 16] },
];

/** A pier along a pond's south shore, on posts down to the floor, and a rowboat beside it. */
const PIER_AND_BOAT: readonly Shape[] = [
  { _tag: "box", from: [12, 0, 18], ramp: "wood", tone: 0, to: [12, 12, 18] },
  { _tag: "box", from: [12, 0, 22], ramp: "wood", tone: 0, to: [12, 12, 22] },
  { _tag: "box", from: [4, 0, 18], ramp: "wood", tone: 0, to: [4, 12, 18] },
  { _tag: "box", from: [4, 0, 22], ramp: "wood", tone: 0, to: [4, 12, 22] },
  { _tag: "box", from: [0, 12, 18], ramp: "wood", tone: 2, to: [13, 12, 22] },
  {
    _tag: "stripe",
    axis: "x",
    every: 2,
    from: [0, 12, 18],
    to: [13, 12, 22],
    tone: 1,
  },
  { _tag: "box", from: [15, 10, 13], ramp: "wood", tone: 1, to: [21, 11, 16] },
  { _tag: "box", from: [15, 12, 13], ramp: "wood", tone: 2, to: [21, 12, 16] },
  { _tag: "carve", from: [16, 12, 14], to: [20, 12, 15] },
  { _tag: "box", from: [14, 11, 14], ramp: "wood", tone: 2, to: [14, 12, 15] },
  { _tag: "box", from: [22, 11, 14], ramp: "wood", tone: 2, to: [22, 12, 15] },
  { _tag: "box", from: [18, 12, 14], ramp: "wood", tone: 0, to: [18, 12, 15] },
];

/** The pond's stages: a bare pond, then lilies, then lilies with a pier and a boat. */
export const POND_STAGES: readonly (readonly Shape[])[] = [
  [],
  LILIES,
  [...LILIES, ...PIER_AND_BOAT],
];
