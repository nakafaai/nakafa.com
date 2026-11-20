import type { Face } from "@/lib/island/models/parts";
import { meters as m, rgb } from "@/lib/island/models/parts";
import { ball, rod } from "@/lib/island/models/solids";

const CANE = rgb(0xb8_8a_4a);
const LINE = rgb(0xe8_e4_d8);
const FLOAT = rgb(0xd8_45_3a);

/**
 * A villager's fishing rod (ADR 0047, D54), in blocks, held at the origin
 * toward +z: a cane from the hands out over the water, its line falling to
 * the water's face, and a red float on it.
 */
export function tackleFaces(): readonly Face[] {
  const tip = [m(0.2), m(2.3), m(2.4)] as const;
  const float = [m(0.2), m(0.06), m(2.7)] as const;
  return [
    ...rod([m(0.2), m(0.95), m(0.3)], [...tip], [m(0.03), m(0.012)], CANE, 4),
    ...rod([...tip], [...float], [m(0.012), m(0.012)], LINE, 3),
    ...ball([...float], [m(0.09), m(0.09), m(0.09)], FLOAT, 2, 6),
  ];
}
