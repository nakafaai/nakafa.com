import type { Shape } from "@/lib/island/voxel";

/** A grass block: soil under a speckled top two voxels deep. */
export const GRASS_BLOCK: readonly Shape[] = [
  {
    _tag: "box",
    from: [0, 0, 0],
    jitter: 0.25,
    ramp: "soil",
    to: [7, 5, 7],
    tone: 2,
  },
  {
    _tag: "box",
    from: [0, 6, 0],
    jitter: 0.35,
    ramp: "grass",
    to: [7, 7, 7],
    tone: 2,
  },
];

/** A soil block, banded, with a pebble or two. */
export const SOIL_BLOCK: readonly Shape[] = [
  {
    _tag: "box",
    from: [0, 0, 0],
    jitter: 0.25,
    ramp: "soil",
    to: [7, 7, 7],
    tone: 2,
  },
  {
    _tag: "stripe",
    axis: "y",
    every: 4,
    from: [0, 0, 0],
    to: [7, 7, 7],
    tone: 1,
  },
  { _tag: "box", from: [2, 2, 7], ramp: "stone", to: [3, 3, 7], tone: 2 },
  { _tag: "box", from: [7, 5, 4], ramp: "stone", to: [7, 5, 5], tone: 2 },
];

/** A stone block of rough courses. */
export const STONE_BLOCK: readonly Shape[] = [
  {
    _tag: "box",
    from: [0, 0, 0],
    jitter: 0.3,
    ramp: "stone",
    to: [7, 7, 7],
    tone: 2,
  },
  {
    _tag: "stripe",
    axis: "y",
    every: 4,
    from: [0, 0, 0],
    to: [7, 7, 7],
    tone: 1,
  },
];

/** A sand block, fine and pale. */
export const SAND_BLOCK: readonly Shape[] = [
  {
    _tag: "box",
    from: [0, 0, 0],
    jitter: 0.3,
    ramp: "sand",
    to: [7, 7, 7],
    tone: 2,
  },
];

/** A block of wooden planks running east. */
export const PLANK_BLOCK: readonly Shape[] = [
  {
    _tag: "box",
    from: [0, 0, 0],
    jitter: 0.12,
    ramp: "wood",
    to: [7, 7, 7],
    tone: 3,
  },
  {
    _tag: "stripe",
    axis: "y",
    every: 2,
    from: [0, 0, 0],
    to: [7, 7, 7],
    tone: 2,
  },
];

/** A brick block: red courses with pale mortar between. */
export const BRICK_BLOCK: readonly Shape[] = [
  { _tag: "box", from: [0, 0, 0], ramp: "wall", to: [7, 7, 7], tone: 2 },
  {
    _tag: "box",
    from: [0, 0, 0],
    jitter: 0.15,
    ramp: "roof",
    to: [7, 1, 7],
    tone: 1,
  },
  {
    _tag: "box",
    from: [0, 3, 0],
    jitter: 0.15,
    ramp: "roof",
    to: [7, 4, 7],
    tone: 1,
  },
  {
    _tag: "box",
    from: [0, 6, 0],
    jitter: 0.15,
    ramp: "roof",
    to: [7, 7, 7],
    tone: 1,
  },
];

/** A glass block in a wooden frame. */
export const GLASS_BLOCK: readonly Shape[] = [
  { _tag: "box", from: [0, 0, 0], ramp: "wood", to: [7, 7, 7], tone: 2 },
  { _tag: "box", from: [1, 1, 0], ramp: "slate", to: [6, 6, 7], tone: 3 },
  { _tag: "box", from: [0, 1, 1], ramp: "slate", to: [7, 6, 6], tone: 3 },
  { _tag: "box", from: [1, 0, 1], ramp: "slate", to: [6, 7, 6], tone: 3 },
];

/** A block of red roof tiles in rows. */
export const TILE_BLOCK: readonly Shape[] = [
  {
    _tag: "box",
    from: [0, 0, 0],
    jitter: 0.1,
    ramp: "roof",
    to: [7, 7, 7],
    tone: 2,
  },
  {
    _tag: "stripe",
    axis: "y",
    every: 2,
    from: [0, 0, 0],
    to: [7, 7, 7],
    tone: 1,
  },
];

/** A block of blue slate tiles in rows. */
export const SLATE_BLOCK: readonly Shape[] = [
  {
    _tag: "box",
    from: [0, 0, 0],
    jitter: 0.1,
    ramp: "slate",
    to: [7, 7, 7],
    tone: 2,
  },
  {
    _tag: "stripe",
    axis: "y",
    every: 2,
    from: [0, 0, 0],
    to: [7, 7, 7],
    tone: 1,
  },
];
