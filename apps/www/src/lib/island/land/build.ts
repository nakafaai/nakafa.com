import type { Thing } from "@repo/backend/confect/island/things";
import { THINGS } from "@repo/backend/confect/island/things";
import { Array as Arr, Option, Result } from "effect";
import type { Change } from "@/lib/island/land/changes";
import { pointTo, thingAt, thingTo } from "@/lib/island/land/changes";
import { CHUNK } from "@/lib/island/land/chunk";
import { floraOf } from "@/lib/island/land/flora";
import type { Land } from "@/lib/island/land/ground";
import type { spotOf } from "@/lib/island/land/site";
import { footprintOf, placeAt, siteOf } from "@/lib/island/land/site";
import { levelChanges } from "@/lib/island/land/stroke";

/** One thing of a world, named by its chunk and its place on the chunk's half-block grid. */
type Spot = ReturnType<typeof spotOf>;

/** How far past a thing's footprint the wild plants make way for it, in blocks. */
const CLEARING = 0.5;

/** The changes that clear the wild plants rooted in a rectangle. */
function uprootChanges(
  land: Land,
  from: readonly [number, number],
  to: readonly [number, number]
) {
  const chunks = Arr.flatMap(
    Arr.range(Math.floor(from[0] / CHUNK), Math.floor(to[0] / CHUNK)),
    (cx) =>
      Arr.map(
        Arr.range(Math.floor(from[1] / CHUNK), Math.floor(to[1] / CHUNK)),
        (cz) => [cx, cz] as const
      )
  );
  return Arr.getSomes(
    Arr.map(
      Arr.filter(
        Arr.flatMap(chunks, ([cx, cz]) => floraOf(land, cx, cz)),
        (plant) =>
          plant.x >= from[0] &&
          plant.x <= to[0] &&
          plant.z >= from[1] &&
          plant.z <= to[1]
      ),
      (plant) => pointTo(land, "clear", plant.i, plant.j, 1)
    )
  );
}

/** What the land does to take a thing at a place: it is levelled under a building, and the wild plants there make way. */
function groundChanges(
  land: Land,
  kind: Thing,
  x: number,
  z: number,
  turn: number
): readonly Change[] {
  const [halfWidth, halfDepth] = footprintOf(kind, turn);
  const levelled =
    THINGS[kind].shelf === "building" && kind !== "bridge"
      ? levelChanges(
          land,
          [x - halfWidth, z - halfDepth],
          [x + halfWidth, z + halfDepth]
        )
      : [];
  return [
    ...levelled,
    ...uprootChanges(
      land,
      [x - halfWidth - CLEARING, z - halfDepth - CLEARING],
      [x + halfWidth + CLEARING, z + halfDepth + CLEARING]
    ),
  ];
}

/**
 * The step that sets a thing down at a place with a turn (ADR 0050, W2), or
 * why it cannot stand there.
 */
export function setDown(
  land: Land,
  kind: Thing,
  x: number,
  z: number,
  turn: number
) {
  return Result.map(
    siteOf(land, kind, x, z, turn, Option.none()),
    (spot): readonly Change[] => {
      const [sx, sz] = placeAt(spot);
      return [
        ...groundChanges(land, kind, sx, sz, turn),
        thingTo(
          land,
          spot.cx,
          spot.cz,
          spot.at,
          Option.some({ at: spot.at, kind, turn })
        ),
      ];
    }
  );
}

/** The step that takes a thing away, empty when nothing stands at the spot. */
export function pickUp(land: Land, spot: Spot): readonly Change[] {
  return Option.match(thingAt(land, spot.cx, spot.cz, spot.at), {
    onNone: () => [],
    onSome: () => [thingTo(land, spot.cx, spot.cz, spot.at, Option.none())],
  });
}

/** The step that turns a thing a quarter where it stands, or why its turned footprint has no room; empty when nothing stands at the spot. */
export function turned(land: Land, spot: Spot) {
  return Option.match(thingAt(land, spot.cx, spot.cz, spot.at), {
    onNone: () => Result.succeed<readonly Change[]>([]),
    onSome: (thing) => {
      const [x, z] = placeAt(spot);
      const turn = (thing.turn + 1) % 4;
      return Result.map(
        siteOf(land, thing.kind, x, z, turn, Option.some(spot)),
        (): readonly Change[] => [
          thingTo(
            land,
            spot.cx,
            spot.cz,
            spot.at,
            Option.some({ ...thing, turn })
          ),
        ]
      );
    },
  });
}

/** The step that moves a thing to a new place, or why it cannot stand there; empty when nothing stands at the spot. */
export function moved(land: Land, spot: Spot, x: number, z: number) {
  return Option.match(thingAt(land, spot.cx, spot.cz, spot.at), {
    onNone: () => Result.succeed<readonly Change[]>([]),
    onSome: (thing) =>
      Result.map(
        siteOf(land, thing.kind, x, z, thing.turn, Option.some(spot)),
        (next): readonly Change[] => {
          const [nx, nz] = placeAt(next);
          return [
            thingTo(land, spot.cx, spot.cz, spot.at, Option.none()),
            ...groundChanges(land, thing.kind, nx, nz, thing.turn),
            thingTo(
              land,
              next.cx,
              next.cz,
              next.at,
              Option.some({ ...thing, at: next.at })
            ),
          ];
        }
      ),
  });
}
