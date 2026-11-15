import { PLANT_KEYS } from "@repo/backend/confect/island/flora";
import { Array as Arr, HashMap, Option, Schema } from "effect";
import type { Family } from "@/lib/island/fauna/families";
import { SPECIES } from "@/lib/island/fauna/species";
import type { Flora } from "@/lib/island/flora/families";
import { plantLookOf } from "@/lib/island/flora/plants";
import { elephant, PLANS, quadruped, TWEAKS } from "@/lib/island/models/beasts";
import { perch, songbird, wader, waterbird } from "@/lib/island/models/birds";
import type { Bloom } from "@/lib/island/models/blooms";
import { type Coat, coatOf, type Species } from "@/lib/island/models/coat";
import {
  bee,
  beetle,
  butterfly,
  crab,
  snail,
} from "@/lib/island/models/critters";
import { CROPS } from "@/lib/island/models/crops";
import { FLOWERS } from "@/lib/island/models/flowers";
import { GREENS } from "@/lib/island/models/greens";
import { PLANT_HEIGHTS } from "@/lib/island/models/heights";
import { LENGTHS } from "@/lib/island/models/lengths";
import { boundsOf, type Face, meters } from "@/lib/island/models/parts";
import { primate } from "@/lib/island/models/primates";
import { frog, lizard, snake } from "@/lib/island/models/reptiles";
import { scaled, tint } from "@/lib/island/models/solids";
import { Stock, stockFaces } from "@/lib/island/models/stock";
import { eel, fish, ray, turtle } from "@/lib/island/models/swimmers";

/** A four-legged family's builder: the species' own plan when it has one, else its family's. */
const fourLegged =
  (family: keyof typeof PLANS) => (species: Species, coat: Coat) =>
    quadruped(TWEAKS[species.key] ?? PLANS[family], species, coat);

/** Each animal family's 3D builder (ADR 0047, D21 and D25). */
const BUILDERS = {
  bee,
  beetle,
  butterfly,
  crab,
  eel,
  elephant,
  fish,
  frog,
  heavy: fourLegged("heavy"),
  hoof: fourLegged("hoof"),
  lizard,
  perch,
  primate,
  ray,
  rodent: fourLegged("rodent"),
  small: fourLegged("small"),
  snail,
  snake,
  songbird,
  tall: fourLegged("tall"),
  turtle,
  wader,
  waterbird,
} satisfies Record<Family, (species: Species, coat: Coat) => readonly Face[]>;

/**
 * What a species' real size measures in each family (ADR 0047, D21): the
 * height at the shoulder of a hoofed or heavy beast, which its builder makes
 * one, and a snake's length along its body, also one; the top of the head of
 * an upright animal; the length of a long one; and the span of a wide one.
 */
const MEASURES = {
  bee: "long",
  beetle: "long",
  butterfly: "wide",
  crab: "wide",
  eel: "long",
  elephant: "unit",
  fish: "long",
  frog: "long",
  heavy: "unit",
  hoof: "unit",
  lizard: "long",
  perch: "high",
  primate: "high",
  ray: "wide",
  rodent: "long",
  small: "high",
  snail: "long",
  snake: "unit",
  songbird: "long",
  tall: "high",
  turtle: "long",
  wader: "high",
  waterbird: "long",
} satisfies Record<Family, "high" | "long" | "unit" | "wide">;

/** A model's size along what its family measures. */
function measureOf(faces: readonly Face[], measure: (typeof MEASURES)[Family]) {
  const bounds = boundsOf(faces);
  if (measure === "high") {
    return bounds.y[1];
  }
  if (measure === "long") {
    return bounds.z[1] - bounds.z[0];
  }
  return measure === "wide" ? bounds.x[1] - bounds.x[0] : 1;
}

/**
 * One species of the catalog as a true 3D model at its real size, in blocks
 * (ADR 0047, D21 and D25), facing +z, standing on the origin (swimmers
 * centered on it). A farm animal is the herd's own model, so the world has one
 * cow and one duck; every other species is built by its family in its own
 * coat and traits and grown so what its family measures equals its real
 * size: its length from `LENGTHS` for a lizard, a snake, a beaver or a
 * porcupine, else the registry's height.
 */
export function speciesFaces(index: number): readonly Face[] {
  const species = SPECIES[index];
  if (Schema.is(Stock)(species.key)) {
    return stockFaces(species.key);
  }
  const unit = BUILDERS[species.family](species, coatOf(species));
  const size = Option.match(HashMap.get(LENGTHS, species.key), {
    onNone: () => species.height,
    onSome: meters,
  });
  return scaled(unit, size / measureOf(unit, MEASURES[species.family]));
}

/** Each plant family's 3D builder (ADR 0047, D25), and the sprawl of a vine that grows over the ground. */
const FLORA = { ...FLOWERS, ...CROPS, ...GREENS } satisfies Record<
  Flora | "sprawl",
  (bloom: Bloom) => readonly Face[]
>;

/** The vines that lie on the ground with their fruit instead of climbing a stake. */
const SPRAWLERS: readonly (typeof PLANT_KEYS)[number][] = [
  "pumpkin",
  "watermelon",
  "strawberry",
];

/**
 * One plant of the catalog as a true 3D model at its real height, in blocks
 * (ADR 0047, D25): built by its family in its own petal, heart and leaf
 * colors, standing on the origin.
 */
export function plantFaces(index: number): readonly Face[] {
  const look = plantLookOf(index);
  const key = PLANT_KEYS[index];
  const unit = FLORA[Arr.contains(SPRAWLERS, key) ? "sprawl" : look.family]({
    heart: tint(look.coat.belly, 2),
    leaf: tint(look.coat.accent, 2),
    petal: tint(look.coat.body, 2),
    stem: tint(look.coat.accent, 1),
  });
  return scaled(unit, meters(PLANT_HEIGHTS[key]) / boundsOf(unit).y[1]);
}
