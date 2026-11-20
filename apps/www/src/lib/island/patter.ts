import { Array as Arr } from "effect";
import { CHUNK } from "@/lib/island/land/chunk";
import type { Land } from "@/lib/island/land/ground";
import { footprintOf, placeAt, thingsAbout } from "@/lib/island/land/site";

/** The things rain patters on: what stands under a roof. */
const ROOFED = ["cottage", "saung", "library"] as const;

/** How far a roof is heard from, in blocks, and the roof, in square blocks at the ear, that patters at full strength: about a cottage and a half. */
const REACH = 20;
const FULL = 60;

/**
 * How much of the rain about a place falls on a roof (ADR 0047, D42; ADR
 * 0050, W8), from 0 to 1: every cottage, saung and library near the place
 * counts by the ground its roof covers and by how near it stands. Away from
 * every roof the rain only hisses on the grass and the crowns.
 */
export function roofShareOf(land: Land, x: number, z: number) {
  const roofs = Arr.filter(
    thingsAbout(land, Math.floor(x / CHUNK), Math.floor(z / CHUNK)),
    (thing) => Arr.contains(ROOFED, thing.kind)
  );
  const heard = Arr.reduce(roofs, 0, (sum, roof) => {
    const [rx, rz] = placeAt(roof);
    const [halfWidth, halfDepth] = footprintOf(roof.kind, roof.turn);
    const near = Math.max(0, 1 - Math.hypot(rx - x, rz - z) / REACH);
    return sum + halfWidth * halfDepth * 4 * near * near;
  });
  return Math.min(1, heard / FULL);
}
