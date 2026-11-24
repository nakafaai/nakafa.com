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
  x: Schema.Finite,
  y: Schema.Finite,
  z: Schema.Finite,
});

type SeaSpecies = typeof SeaSpeciesSchema.Type;

/**
 * Cited marine species of Malaysian waters whose everyday names often mislead:
 * dugong and Bryde's whale are mammals, moon jellyfish and horned sea star are
 * invertebrates, and Indian mackerel is a true bony fish.
 */
const SEA_SPECIES: Readonly<Record<SeaAnimal, SeaSpecies>> = {
  dugong: {
    id: "dugong",
    isFish: false,
    scientific: "Dugong dugon",
    x: -1.55,
    y: 0.42,
    z: 0.35,
  },
  jellyfish: {
    id: "jellyfish",
    isFish: false,
    scientific: "Aurelia aurita",
    x: 0.0,
    y: 0.72,
    z: 0.42,
  },
  mackerel: {
    id: "mackerel",
    isFish: true,
    scientific: "Rastrelliger kanagurta",
    x: 1.55,
    y: 0.48,
    z: 0.2,
  },
  seaStar: {
    id: "seaStar",
    isFish: false,
    scientific: "Protoreaster nodosus",
    x: 0.8,
    y: 0.08,
    z: 0.75,
  },
  whale: {
    id: "whale",
    isFish: false,
    scientific: "Balaenoptera edeni",
    x: -0.65,
    y: 0.78,
    z: -0.55,
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
