import { Match, Schema } from "effect";

const CalorimeterMaterialSchema = Schema.Literals([
  "water",
  "aluminium",
  "copper",
  "iron",
  "oil",
]);

export type CalorimeterMaterial = typeof CalorimeterMaterialSchema.Type;

const CalorimeterReadingSchema = Schema.Struct({
  energyJ: Schema.Finite,
  specificHeatJPerKgK: Schema.Finite,
  temperatureRiseK: Schema.Finite,
});

function specificHeatOf(material: CalorimeterMaterial): number {
  return Match.value(material).pipe(
    Match.when("water", () => 4186),
    Match.when("aluminium", () => 900),
    Match.when("copper", () => 385),
    Match.when("iron", () => 450),
    Match.when("oil", () => 2000),
    Match.exhaustive
  );
}

/** Evaluate electrical energy supplied Q = P * t and temperature rise dT = Q / (m * c). */
export function evaluateCalorimeter(
  material: CalorimeterMaterial,
  massKg: number,
  powerW: number,
  minutes: number
): typeof CalorimeterReadingSchema.Type {
  const safeMass = Math.max(0.05, massKg);
  const safePower = Math.max(1, powerW);
  const safeMinutes = Math.max(0.1, minutes);
  const specificHeatJPerKgK = specificHeatOf(material);
  const energyJ = safePower * safeMinutes * 60;
  const temperatureRiseK = energyJ / (safeMass * specificHeatJPerKgK);
  return {
    energyJ,
    specificHeatJPerKgK,
    temperatureRiseK,
  };
}
