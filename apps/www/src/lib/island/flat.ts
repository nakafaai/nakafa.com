import { SPAN } from "@repo/backend/confect/island/world";
import { Array as Arr } from "effect";
import type { TileName } from "@/lib/island/atlas";
import { SLOTS, slotUv } from "@/lib/island/atlas";
import { STRIDE } from "@/lib/island/mesh";
import { SCALE } from "@/lib/island/scale";
import { SEA_LEVEL } from "@/lib/island/world";

/** How fast Nina swims her loop, in cells a second. */
const NINA_SPEED = 1.5;

/**
 * Where Nina, the hammerhead (ADR 0047, D8), swims at `time`: a loop around
 * the island just past its footprint, where the sea is, weaving in and out a
 * little, and the way she faces along it.
 */
export function ninaAt(size: number, time: number) {
  const radius = size / 2 + 2;
  const angle = (time * NINA_SPEED) / radius;
  const reach = radius + Math.sin(angle * 5) * 1.2;
  const outward = Math.cos(angle * 5) * 6;
  const middle = SPAN / 2;
  return {
    heading: Math.atan2(
      outward * Math.sin(angle) + reach * Math.cos(angle),
      outward * Math.cos(angle) - reach * Math.sin(angle)
    ),
    x: middle + Math.cos(angle) * reach,
    z: middle + Math.sin(angle) * reach,
  };
}

/** Nina's four corners, flat on the sea's surface, her head along her heading and her tail beating. */
function ninaVertices(size: number, time: number) {
  const nina = ninaAt(size, time);
  const ahead = [Math.cos(nina.heading), Math.sin(nina.heading)] as const;
  const name: TileName = Math.floor(time * 3) % 2 === 1 ? "ninaStep" : "nina";
  const corner = (u: number, v: number) => {
    const along = (u - 0.5) * SCALE.nina;
    const across = (v - 0.5) * SCALE.nina;
    return [
      nina.x + ahead[0] * along - ahead[1] * across,
      SEA_LEVEL - 0.06,
      nina.z + ahead[1] * along + ahead[0] * across,
    ] as const;
  };
  return quadOf(SLOTS[name], [
    corner(0, 1),
    corner(1, 1),
    corner(1, 0),
    corner(0, 0),
  ]);
}

/** A quad's four corners, as the chunk program reads them, from its tile's slot and its corners in the world. */
function quadOf(
  slot: number,
  corners: readonly (readonly [number, number, number])[]
) {
  return Arr.flatMap(
    [
      [0, 1],
      [1, 1],
      [1, 0],
      [0, 0],
    ] as const,
    ([u, v], corner) => {
      const [tu, tv] = slotUv(slot, u, v);
      return [...corners[corner], tu, tv, 1, 1, 0, 0];
    }
  );
}

/** One upright quad of a tile standing at `at`, `size` blocks tall, facing a camera turned by `yaw`: the fishing float on the water. */
export function standingQuad(
  slot: number,
  at: readonly [number, number, number],
  size: number,
  yaw: number
) {
  const right = [Math.cos(yaw), -Math.sin(yaw)] as const;
  const corner = (u: number, up: number) =>
    [
      at[0] + right[0] * (u - 0.5) * size,
      at[1] + up * size,
      at[2] + right[1] * (u - 0.5) * size,
    ] as const;
  return quadOf(slot, [corner(0, 0), corner(1, 0), corner(1, 1), corner(0, 1)]);
}

/**
 * What of the island's life is still drawn flat, as quads in the chunk
 * program's vertex layout: the quads handed in (`extra`, the fishing float),
 * then Nina lying flat on the sea, swimming her loop. The herd, the fox, the
 * wild visitors and the sea's swimmers are true 3D bodies (ADR 0047, D21, D24
 * and D25).
 */
export function flatQuads(
  size: number,
  time: number,
  extra: readonly number[] = []
) {
  const vertices = new Float32Array(
    Arr.appendAll(extra, ninaVertices(size, time))
  );
  const quads = extra.length / (4 * STRIDE) + 1;
  const indices = new Uint32Array(
    Arr.flatMap(
      Arr.makeBy(quads, (quad) => quad),
      (quad) => Arr.map([0, 1, 2, 0, 2, 3], (value) => value + quad * 4)
    )
  );
  return { indices, vertices };
}
