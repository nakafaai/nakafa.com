import type { StageBudget } from "@repo/design-system/components/three/stage/tier";
import { Array as Arr, Match, Schema } from "effect";

/** A point of a lathe profile: its distance from the axis and its height. */
const ProfilePointSchema = Schema.Tuple([Schema.Finite, Schema.Finite]);
type ProfilePoint = typeof ProfilePointSchema.Type;

/** How deep the mould seam cuts into the unit sphere, and how wide it is in radians. */
const SEAM_DEPTH = 0.012;
const SEAM_WIDTH = 0.035;

/**
 * How finely the stage's tier draws each atom and rod: rings from pole to
 * pole, sides around the axis, and sides around a rod.
 */
export function facetsOf(tier: StageBudget["tier"]) {
  return Match.value(tier).pipe(
    Match.when("full", () => ({ rings: 20, rod: 14, sides: 28 })),
    Match.when("light", () => ({ rings: 14, rod: 10, sides: 20 })),
    Match.orElse(() => ({ rings: 10, rod: 8, sides: 14 }))
  );
}

/** From how many atoms a model is a crowd, drawn coarser so a membrane of thousands still holds its frame rate. */
const CROWD = 900;

/**
 * How finely a model of `atoms` atoms draws each of them at the stage's
 * tier: as the tier asks, or, in a crowd where each atom covers only a few
 * pixels, with the fewest facets that still read as round.
 */
export function atomFacets(tier: StageBudget["tier"], atoms: number) {
  return atoms > CROWD ? { rings: 8, rod: 6, sides: 12 } : facetsOf(tier);
}

/**
 * The profile of a moulded atom of radius one, from its south pole to its
 * north: a sphere with the fine seam the two halves of a mould leave around
 * its equator, as on the atoms of a real model kit. An odd count of `rings`
 * is raised to the next even one so a ring always falls on the seam.
 */
export function seamProfile(rings: number): readonly ProfilePoint[] {
  const count = Math.max(4, rings + (rings % 2));
  return Arr.flatMap(Arr.range(0, count), (ring): readonly ProfilePoint[] => {
    if (ring * 2 !== count) {
      return [at(-Math.PI / 2 + (Math.PI * ring) / count, 1)];
    }
    return [at(-SEAM_WIDTH, 1), at(0, 1 - SEAM_DEPTH), at(SEAM_WIDTH, 1)];
  });
}

/** The profile point at a latitude, on a sphere of the given radius. */
function at(latitude: number, radius: number): ProfilePoint {
  return [Math.cos(latitude) * radius, Math.sin(latitude) * radius];
}
