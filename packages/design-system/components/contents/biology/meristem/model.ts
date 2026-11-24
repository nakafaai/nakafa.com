import { Schema } from "effect";

const GrowthModeSchema = Schema.Literals(["primary", "secondary"]);

export type GrowthMode = typeof GrowthModeSchema.Type;

const PlantOrganSchema = Schema.Literals(["root", "shoot"]);

export type PlantOrgan = typeof PlantOrganSchema.Type;

const GrowthZoneSchema = Schema.Literals([
  "division",
  "elongation",
  "differentiation",
]);

export type GrowthZone = typeof GrowthZoneSchema.Type;

const PrimaryScanSchema = Schema.Struct({
  axisY: Schema.Finite,
  position: Schema.Finite,
  zone: GrowthZoneSchema,
});

type PrimaryScan = typeof PrimaryScanSchema.Type;

const SecondaryCrossSectionSchema = Schema.Struct({
  outerRadius: Schema.Finite,
  ringCount: Schema.Int,
  xylemRadius: Schema.Finite,
});

type SecondaryCrossSection = typeof SecondaryCrossSectionSchema.Type;

function zoneForPosition(position: number): GrowthZone {
  if (position < 34) {
    return "division";
  }
  if (position < 68) {
    return "elongation";
  }
  return "differentiation";
}

/** Clamp an axis probe position to [0, 100] and classify its primary growth zone. */
export function evaluatePrimaryZone(position: number): PrimaryScan {
  const clamped = Math.min(100, Math.max(0, position));
  const zone = zoneForPosition(clamped);
  const axisY = 0.24 + (clamped / 100) * 1.12;
  return { axisY, position: clamped, zone };
}

/** Compute radial thickening geometry and annual ring count for a given stem age. */
export function evaluateSecondaryGrowth(years: number): SecondaryCrossSection {
  const ringCount = Math.min(10, Math.max(1, Math.round(years)));
  const xylemRadius = 0.22 + ringCount * 0.055;
  const outerRadius = xylemRadius + 0.14;
  return { outerRadius, ringCount, xylemRadius };
}
