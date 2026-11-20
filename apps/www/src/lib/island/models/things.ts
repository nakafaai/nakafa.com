import type { Thing } from "@repo/backend/confect/island/things";
import { CRAFT } from "@/lib/island/models/craft";
import { GARDEN } from "@/lib/island/models/garden";
import { HOMES } from "@/lib/island/models/homes";
import { PALMS } from "@/lib/island/models/palms";
import type { Face } from "@/lib/island/models/parts";
import { boundsOf, meters } from "@/lib/island/models/parts";
import { reefFaces } from "@/lib/island/models/reef";
import { scaled } from "@/lib/island/models/solids";
import { TREES } from "@/lib/island/models/trees";
import { WORKS } from "@/lib/island/models/works";
import { YARD } from "@/lib/island/models/yard";
import { SCALE } from "@/lib/island/scale";

/**
 * What grows under and on the water (ADR 0050, W2), each from the reef's own
 * model of it (ADR 0047, D50): a lily pad, a staghorn coral, a brain coral and
 * a tuft of seagrass. The reef builds in blocks, so each is brought to meters
 * like every other builder here.
 */
const WATERS = {
  brain: (look: number) => scaled(reefFaces("brain", look), SCALE.block),
  coral: (look: number) => scaled(reefFaces("branching", look), SCALE.block),
  lily: (look: number) => scaled(reefFaces("lily", look), SCALE.block),
  seagrass: (look: number) => scaled(reefFaces("seagrass", look), SCALE.block),
};

/** How each kind is built, in meters, from its look. */
const BUILDERS: Record<Thing, (look: number) => readonly Face[]> = {
  ...TREES,
  ...PALMS,
  ...GARDEN,
  ...HOMES,
  ...WORKS,
  ...YARD,
  ...CRAFT,
  ...WATERS,
};

/**
 * How many looks each kind comes in. What grows by itself has three, each its
 * own size, lean and crown, so no two neighbours repeat; what is built has
 * the one it was designed with.
 */
export const THING_LOOKS: Record<Thing, number> = {
  ball: 1,
  balloon: 1,
  banana: 3,
  bench: 1,
  boat: 1,
  brain: 3,
  bridge: 1,
  bush: 3,
  campfire: 1,
  casuarina: 3,
  coral: 3,
  cottage: 1,
  fence: 1,
  flame: 3,
  flowerbed: 3,
  kite: 1,
  lantern: 1,
  library: 1,
  lighthouse: 1,
  lily: 3,
  mango: 3,
  palm: 3,
  pine: 3,
  reed: 3,
  rocks: 3,
  saung: 1,
  seagrass: 3,
  sunflower: 3,
  well: 1,
  windmill: 1,
};

/**
 * The faces of one look of one kind, in blocks, standing on the ground at the
 * origin with its front toward +z. A look past the kind's last starts over
 * from its first, so any whole number a world stores draws something.
 */
export function thingFaces(kind: Thing, look: number): readonly Face[] {
  return scaled(BUILDERS[kind](Math.abs(look) % THING_LOOKS[kind]), meters(1));
}

/** The room a kind takes on the land, in blocks, measured from its first look: how wide, how deep and how high it stands. */
export function thingSize(kind: Thing) {
  const { x, y, z } = boundsOf(thingFaces(kind, 0));
  return { depth: z[1] - z[0], height: y[1] - y[0], width: x[1] - x[0] };
}
