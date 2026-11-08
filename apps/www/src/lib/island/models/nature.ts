import type { Shape } from "@/lib/island/voxel";

/** A round bush of leaves on a little soil. */
export const BUSH: readonly Shape[] = [
  {
    _tag: "blob",
    center: [4, 3, 4],
    jitter: 0.3,
    radius: [4, 3, 4],
    ramp: "leaf",
    tone: 2,
  },
  {
    _tag: "blob",
    center: [3, 5, 3],
    jitter: 0.25,
    radius: [2, 2, 2],
    ramp: "leaf",
    tone: 3,
  },
];

/** A grey boulder with a lighter top. */
export const ROCK: readonly Shape[] = [
  {
    _tag: "blob",
    center: [4, 2, 4],
    jitter: 0.3,
    radius: [4, 3, 3],
    ramp: "stone",
    tone: 2,
  },
  {
    _tag: "blob",
    center: [3, 4, 4],
    jitter: 0.2,
    radius: [2, 1, 2],
    ramp: "stone",
    tone: 3,
  },
];

/** A lamp post: a dark post under a lantern that glows. */
export const LAMP: readonly Shape[] = [
  { _tag: "box", from: [3, 0, 3], ramp: "stone", to: [4, 0, 4], tone: 1 },
  { _tag: "box", from: [3, 1, 3], ramp: "ink", to: [4, 9, 4], tone: 2 },
  { _tag: "box", from: [2, 10, 2], ramp: "ink", to: [5, 10, 5], tone: 2 },
  { _tag: "box", from: [2, 11, 2], ramp: "glow", to: [5, 13, 5], tone: 3 },
  { _tag: "box", from: [2, 14, 2], ramp: "ink", to: [5, 14, 5], tone: 2 },
  { _tag: "box", from: [3, 15, 3], ramp: "ink", to: [4, 15, 4], tone: 2 },
];

/** A seed in a mound of soil, with its first two leaves. */
export const SEED: readonly Shape[] = [
  {
    _tag: "blob",
    center: [12, 0, 12],
    radius: [3, 1, 3],
    ramp: "soil",
    tone: 2,
  },
  { _tag: "box", from: [12, 1, 12], ramp: "leaf", to: [12, 2, 12], tone: 2 },
  { _tag: "box", from: [11, 3, 12], ramp: "leaf", to: [11, 3, 12], tone: 3 },
  { _tag: "box", from: [13, 3, 12], ramp: "leaf", to: [13, 3, 12], tone: 3 },
];

/** A young tree: a thin trunk under a small crown. */
export const SAPLING: readonly Shape[] = [
  {
    _tag: "cylinder",
    bottom: 0,
    center: [12, 12],
    jitter: 0.2,
    radius: 1.2,
    ramp: "wood",
    top: 8,
    tone: 2,
  },
  {
    _tag: "blob",
    center: [12, 11, 12],
    jitter: 0.3,
    radius: [5, 4, 5],
    ramp: "leaf",
    tone: 2,
  },
  {
    _tag: "blob",
    center: [11, 14, 12],
    jitter: 0.25,
    radius: [3, 2, 3],
    ramp: "leaf",
    tone: 3,
  },
];
