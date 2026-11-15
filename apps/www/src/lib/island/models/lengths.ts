import { HashMap } from "effect";
import type { Species } from "@/lib/island/models/coat";

/**
 * The real length in meters, snout to tail tip, of each species whose size is
 * its length rather than its height (ADR 0047, D25): every lizard and snake,
 * and the beaver and porcupine with their tails. The registry keeps each
 * species' standing height; its 3D model is grown to this length instead.
 */
export const LENGTHS = HashMap.fromIterable<Species["key"], number>([
  ["beaver", 1.1],
  ["chameleon", 0.45],
  ["cobra", 1.8],
  ["crocodile", 3.8],
  ["gecko", 0.3],
  ["house-lizard", 0.12],
  ["iguana", 1.5],
  ["komodo", 2.6],
  ["monitor", 1.6],
  ["porcupine", 0.75],
  ["python", 4],
  ["sea-snake", 1],
  ["tree-snake", 1],
]);
