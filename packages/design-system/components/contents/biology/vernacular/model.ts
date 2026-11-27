import { Array as Arr, Option, Schema } from "effect";

const SeaAnimalSchema = Schema.Literals([
  "dugong",
  "whale",
  "jellyfish",
  "seaStar",
  "mackerel",
]);
export type SeaAnimal = typeof SeaAnimalSchema.Type;

const SeaLanguageSchema = Schema.Literals([
  "malay",
  "english",
  "indonesian",
  "german",
]);
export type SeaLanguage = typeof SeaLanguageSchema.Type;

const SeaSpeciesSchema = Schema.Struct({
  id: SeaAnimalSchema,
  isFish: Schema.Boolean,
  scientific: Schema.String,
  tag: Schema.Finite,
  x: Schema.Finite,
  y: Schema.Finite,
  z: Schema.Finite,
});

type SeaSpecies = typeof SeaSpeciesSchema.Type;

/**
 * Cited marine species of Malaysian waters whose everyday names often mislead:
 * dugong and Bryde's whale are mammals, moon jellyfish and horned sea star are
 * invertebrates, and Indian mackerel is a true bony fish. Each has its place
 * in the water, and `tag` is how far above it its name tag hangs.
 */
const SEA_SPECIES: Readonly<Record<SeaAnimal, SeaSpecies>> = {
  dugong: {
    id: "dugong",
    isFish: false,
    scientific: "Dugong dugon",
    tag: 0.24,
    x: -1.0,
    y: 0.36,
    z: 0.45,
  },
  jellyfish: {
    id: "jellyfish",
    isFish: false,
    scientific: "Aurelia aurita",
    tag: 0.17,
    x: -0.1,
    y: 0.5,
    z: 0.6,
  },
  mackerel: {
    id: "mackerel",
    isFish: true,
    scientific: "Rastrelliger kanagurta",
    tag: 0.2,
    x: 0.9,
    y: 0.8,
    z: 0.1,
  },
  seaStar: {
    id: "seaStar",
    isFish: false,
    scientific: "Protoreaster nodosus",
    tag: 0.2,
    x: 0.6,
    y: 0.08,
    z: 1.0,
  },
  whale: {
    id: "whale",
    isFish: false,
    scientific: "Balaenoptera edeni",
    tag: 0.2,
    x: -0.45,
    y: 1.06,
    z: -0.9,
  },
};

/** Returns the cited species record for one Malaysian sea animal. */
export function seaSpeciesOf(animal: SeaAnimal): SeaSpecies {
  return SEA_SPECIES[animal];
}

/**
 * Evenly distributes the active animals across the shallow sea view when a
 * lesson shows a subset of the five species.
 */
export function seaSlotPosition(
  animals: readonly SeaAnimal[],
  animal: SeaAnimal
): readonly [number, number, number] {
  const species = SEA_SPECIES[animal];
  if (animals.length >= 5) {
    return [species.x, species.y, species.z];
  }
  const index = Option.getOrElse(
    Arr.findFirstIndex(animals, (entry) => entry === animal),
    () => 0
  );
  const spread = animals.length <= 1 ? 0 : 2.4 / (animals.length - 1);
  const x = animals.length <= 1 ? 0 : -1.2 + index * spread;
  const z = index % 2 === 0 ? 0.25 : -0.25;
  return [x, species.y, z];
}

/** Reads an animal's common name in the chosen language, falling back to its scientific name. */
export function seaCommonName(
  names: Readonly<
    Partial<Record<SeaAnimal, Readonly<Partial<Record<SeaLanguage, string>>>>>
  >,
  animal: SeaAnimal,
  language: SeaLanguage
): string {
  return names[animal]?.[language] ?? SEA_SPECIES[animal].scientific;
}
