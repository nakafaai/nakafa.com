import type { Placement } from "@repo/backend/confect/island/layout";

/**
 * The pieces every new island starts with: a big tree at the back and a small
 * hut in front of it, so the camera sees both. They paid nothing, so they can be
 * moved, turned and upgraded but never removed, and a gift never becomes Stars
 * (ADR 0042, D5).
 */
export const STARTER_LAYOUT: readonly Placement[] = [
  {
    growth: 0,
    item: "house",
    paid: 0,
    rotation: 0,
    stage: 0,
    x: 3,
    y: 2,
    z: 0,
  },
  { growth: 0, item: "tree", paid: 0, rotation: 0, stage: 2, x: 1, y: 1, z: 0 },
];
