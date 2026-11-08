import type { Shape } from "@/lib/island/voxel";

/** The big tree: a thick trunk with root flares under a round crown of leaves. */
export const BIG_TREE: readonly Shape[] = [
  {
    _tag: "cylinder",
    bottom: 0,
    center: [12, 12],
    radius: 2.4,
    ramp: "wood",
    tone: 1,
    top: 16,
    jitter: 0.3,
  },
  { _tag: "box", from: [9, 0, 11], ramp: "wood", tone: 1, to: [10, 1, 12] },
  { _tag: "box", from: [14, 0, 12], ramp: "wood", tone: 1, to: [15, 1, 13] },
  { _tag: "box", from: [11, 0, 14], ramp: "wood", tone: 1, to: [12, 1, 15] },
  { _tag: "box", from: [12, 0, 9], ramp: "wood", tone: 1, to: [13, 1, 10] },
  { _tag: "box", from: [12, 13, 7], ramp: "wood", tone: 1, to: [13, 15, 11] },
  {
    _tag: "blob",
    center: [12, 20, 12],
    radius: [9, 6, 9],
    ramp: "leaf",
    tone: 2,
    jitter: 0.3,
  },
  {
    _tag: "blob",
    center: [7, 23, 14],
    radius: [6, 5, 6],
    ramp: "leaf",
    tone: 2,
    jitter: 0.3,
  },
  {
    _tag: "blob",
    center: [17, 23, 10],
    radius: [6, 5, 6],
    ramp: "leaf",
    tone: 2,
    jitter: 0.3,
  },
  {
    _tag: "blob",
    center: [12, 26, 13],
    radius: [6, 5, 6],
    ramp: "leaf",
    tone: 3,
    jitter: 0.3,
  },
  {
    _tag: "blob",
    center: [13, 29, 11],
    radius: [4, 3, 4],
    ramp: "leaf",
    tone: 3,
    jitter: 0.25,
  },
];

/** One apple: a red cube two voxels wide with a light corner, set into the crown's face. */
function apple(x: number, y: number, z: number): readonly Shape[] {
  return [
    {
      _tag: "box",
      from: [x, y, z],
      ramp: "roof",
      tone: 2,
      to: [x + 1, y + 1, z + 1],
    },
    {
      _tag: "box",
      from: [x + 1, y + 1, z + 1],
      ramp: "roof",
      tone: 3,
      to: [x + 1, y + 1, z + 1],
    },
  ];
}

/**
 * The big tree in fruit, its last stage (ADR 0042, D13): apples sit just inside
 * the crown's faces that turn toward the viewer, so each one shows.
 */
export const FRUIT_TREE: readonly Shape[] = [
  ...BIG_TREE,
  ...apple(17, 19, 17),
  ...apple(19, 21, 13),
  ...apple(13, 22, 19),
  ...apple(9, 22, 18),
  ...apple(21, 22, 12),
  ...apple(15, 27, 17),
];
