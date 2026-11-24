import { Array as Arr, Schema } from "effect";

const GardenPlantSchema = Schema.Literals([
  "kangkung",
  "sweetPotato",
  "mango",
  "beluntas",
  "neem",
  "padi",
]);
export type GardenPlant = typeof GardenPlantSchema.Type;

const NameStyleSchema = Schema.Literals(["printed", "handwritten"]);
export type NameStyle = typeof NameStyleSchema.Type;

const MatchModeSchema = Schema.Literals(["genus", "epithet"]);
export type MatchMode = typeof MatchModeSchema.Type;

const BotanicalSpecSchema = Schema.Struct({
  epithet: Schema.String,
  family: Schema.String,
  genus: Schema.String,
  id: GardenPlantSchema,
});
type BotanicalSpec = typeof BotanicalSpecSchema.Type;

/**
 * Cited binomial names for the six school-garden plants: water spinach and
 * sweet potato share the genus Ipomoea (same family), while mango, beluntas
 * and neem share only the epithet indica across three different families.
 */
const GARDEN_PLANTS: Readonly<Record<GardenPlant, BotanicalSpec>> = {
  beluntas: {
    epithet: "indica",
    family: "Asteraceae",
    genus: "Pluchea",
    id: "beluntas",
  },
  kangkung: {
    epithet: "aquatica",
    family: "Convolvulaceae",
    genus: "Ipomoea",
    id: "kangkung",
  },
  mango: {
    epithet: "indica",
    family: "Anacardiaceae",
    genus: "Mangifera",
    id: "mango",
  },
  neem: {
    epithet: "indica",
    family: "Meliaceae",
    genus: "Azadirachta",
    id: "neem",
  },
  padi: {
    epithet: "sativa",
    family: "Poaceae",
    genus: "Oryza",
    id: "padi",
  },
  sweetPotato: {
    epithet: "batatas",
    family: "Convolvulaceae",
    genus: "Ipomoea",
    id: "sweetPotato",
  },
};

/** Returns the binomial classification data for one garden plant. */
export function botanicalOf(plant: GardenPlant): BotanicalSpec {
  return GARDEN_PLANTS[plant];
}

/**
 * Returns every shown plant that shares either the genus (first word) or the
 * specific epithet (second word) with the selected plant.
 */
export function matchingPlants(
  plants: readonly GardenPlant[],
  selected: GardenPlant,
  mode: MatchMode
): readonly GardenPlant[] {
  const focus = GARDEN_PLANTS[selected];
  return Arr.filter(plants, (plant) => {
    const candidate = GARDEN_PLANTS[plant];
    return mode === "genus"
      ? candidate.genus === focus.genus
      : candidate.epithet === focus.epithet;
  });
}

/** Grid coordinates for up to six garden beds in two neat rows. */
export function gardenBedPosition(
  index: number,
  count: number
): readonly [number, number, number] {
  const columns = count <= 3 ? count : Math.ceil(count / 2);
  const row = Math.floor(index / columns);
  const col = index % columns;
  const rows = Math.ceil(count / columns);
  const x = (col - (columns - 1) / 2) * 1.15;
  const z = (row - (rows - 1) / 2) * 1.25;
  return [x, 0, z];
}
