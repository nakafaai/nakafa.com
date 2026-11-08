import type { Shape } from "@/lib/island/voxel";

/** The voxel grid a cloud is drawn in. */
export const CLOUD_SIZE = [40, 12, 28] as const;

/** A soft cloud of four puffs, drawn once and set under the island a few times. */
export const CLOUD_SHAPES: readonly Shape[] = [
  {
    _tag: "blob",
    center: [20, 4, 14],
    radius: [17, 4, 11],
    ramp: "cloud",
    tone: 2,
  },
  {
    _tag: "blob",
    center: [11, 6, 12],
    radius: [8, 4, 7],
    ramp: "cloud",
    tone: 3,
  },
  {
    _tag: "blob",
    center: [29, 6, 15],
    radius: [9, 4, 8],
    ramp: "cloud",
    tone: 3,
  },
  {
    _tag: "blob",
    center: [20, 8, 13],
    radius: [8, 3, 6],
    ramp: "cloud",
    tone: 3,
  },
];
