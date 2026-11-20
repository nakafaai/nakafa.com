import { Array as Arr, Option, Schema } from "effect";
import type { Habitat } from "@/lib/island/fauna/habitat";
import { habitatAt } from "@/lib/island/fauna/habitat";
import { CHUNK } from "@/lib/island/land/chunk";
import type { Land } from "@/lib/island/land/ground";
import { flowAt, surfaceAt } from "@/lib/island/land/ground";
import { placeAt, thingsAbout } from "@/lib/island/land/site";

/**
 * What lies about a place of the land, as the ear takes it (ADR 0050, W8),
 * each from 0 for none to 1 for right there: the sea, fresh water of any
 * kind, a river running, a waterfall, a fire, and how much of the ground
 * about is forest and how much is meadow.
 */
export const Surround = Schema.Struct({
  fall: Schema.Finite,
  fire: Schema.Finite,
  forest: Schema.Finite,
  fresh: Schema.Finite,
  meadow: Schema.Finite,
  river: Schema.Finite,
  sea: Schema.Finite,
});
export type Surround = typeof Surround.Type;

/** How far the ear reaches over the land, how far apart it listens, and how far a fire carries, in blocks. */
const REACH = { ear: 30, fire: 14, ring: 6 } as const;

/** How fast water must run to be heard as a river, as a share of a full flow, and how far its face must drop over two blocks to be heard as a fall. */
const RUN = { drop: 0.5, flow: 0.2 } as const;

/** The places the ear listens at about a place: the place itself, then eight ways round it on every ring, each with how near it is, 1 at the place. */
function listenedOf(x: number, z: number) {
  const rings = REACH.ear / REACH.ring;
  return Arr.prepend(
    Arr.makeBy(rings * 8, (slot) => {
      const away = (Math.floor(slot / 8) + 1) * REACH.ring;
      const turn = ((slot % 8) / 8) * Math.PI * 2;
      return {
        near: 1 - away / (REACH.ear + REACH.ring),
        x: x + Math.cos(turn) * away,
        z: z + Math.sin(turn) * away,
      };
    }),
    { near: 1, x, z }
  );
}

/** What the ear takes from one place: its habitat, and whether its water runs and whether it falls. */
function heardAt(land: Land, x: number, z: number) {
  const habitat = habitatAt(land, x, z);
  const [across, deep] = flowAt(land, x, z);
  const runs =
    Option.contains(habitat, "fresh") && Math.hypot(across, deep) > RUN.flow;
  const drop = Math.max(
    Math.abs(surfaceAt(land, x + 1, z) - surfaceAt(land, x - 1, z)),
    Math.abs(surfaceAt(land, x, z + 1) - surfaceAt(land, x, z - 1))
  );
  return { falls: runs && drop > RUN.drop, habitat, runs };
}

/** How near the nearest fire burns to a place, from 0 beyond its reach to 1 beside it. */
function fireAt(land: Land, x: number, z: number) {
  const fires = Arr.filter(
    thingsAbout(land, Math.floor(x / CHUNK), Math.floor(z / CHUNK)),
    (thing) => thing.kind === "campfire"
  );
  return Arr.reduce(fires, 0, (nearest, fire) => {
    const [fx, fz] = placeAt(fire);
    return Math.max(nearest, 1 - Math.hypot(fx - x, fz - z) / REACH.fire);
  });
}

/**
 * What lies about a place of the land (ADR 0050, W8), read from the land
 * itself on rings about the place: a water is as loud as its nearest point is
 * near, and a forest or a meadow as much as it fills the ground about.
 */
export function surroundOf(land: Land, x: number, z: number): Surround {
  const heard = Arr.map(listenedOf(x, z), (spot) => ({
    ...heardAt(land, spot.x, spot.z),
    near: spot.near,
  }));
  const whole = Arr.reduce(heard, 0, (sum, spot) => sum + spot.near);
  const nearest = (is: (spot: (typeof heard)[number]) => boolean) =>
    Arr.reduce(heard, 0, (most, spot) =>
      is(spot) ? Math.max(most, spot.near) : most
    );
  const share = (habitat: Habitat) =>
    Arr.reduce(heard, 0, (sum, spot) =>
      Option.contains(spot.habitat, habitat) ? sum + spot.near : sum
    ) / whole;
  return {
    fall: nearest((spot) => spot.falls),
    fire: fireAt(land, x, z),
    forest: share("forest"),
    fresh: nearest((spot) => Option.contains(spot.habitat, "fresh")),
    meadow: share("meadow"),
    river: nearest((spot) => spot.runs),
    sea: nearest(
      (spot) =>
        Option.contains(spot.habitat, "sea") ||
        Option.contains(spot.habitat, "shallows")
    ),
  };
}
