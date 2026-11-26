import { Match, Schema } from "effect";

const RevolutionProfileSchema = Schema.Literals([
  "paraboloid",
  "trumpetHorn",
  "washerBowl",
  "frustumCone",
]);

export type RevolutionProfile = typeof RevolutionProfileSchema.Type;

const RevolutionMetricsSchema = Schema.Struct({
  innerRadius: Schema.Finite,
  outerRadius: Schema.Finite,
  sliceArea: Schema.Finite,
  sweptVolume: Schema.Finite,
});

/** Compute disk/washer cross-section area and swept revolution volume for a given sweep angle (deg). */
export function evaluateSolidRevolution(
  profile: RevolutionProfile,
  sweepDeg: number
): typeof RevolutionMetricsSchema.Type {
  const fraction = Math.min(1, Math.max(0.05, sweepDeg / 360));
  return Match.value(profile).pipe(
    Match.when("paraboloid", () => ({
      innerRadius: 0,
      outerRadius: 0.78,
      sliceArea: Number((Math.PI * 0.78 * 0.78).toFixed(2)),
      sweptVolume: Number((Math.PI * 2 * fraction).toFixed(2)),
    })),
    Match.when("trumpetHorn", () => ({
      innerRadius: 0,
      outerRadius: 0.62,
      sliceArea: Number((Math.PI * 0.62 * 0.62).toFixed(2)),
      sweptVolume: Number((Math.PI * 1.4 * fraction).toFixed(2)),
    })),
    Match.when("washerBowl", () => ({
      innerRadius: 0.34,
      outerRadius: 0.84,
      sliceArea: Number((Math.PI * (0.84 * 0.84 - 0.34 * 0.34)).toFixed(2)),
      sweptVolume: Number((Math.PI * 2.4 * fraction).toFixed(2)),
    })),
    Match.when("frustumCone", () => ({
      innerRadius: 0,
      outerRadius: 0.72,
      sliceArea: Number((Math.PI * 0.72 * 0.72).toFixed(2)),
      sweptVolume: Number((Math.PI * 1.85 * fraction).toFixed(2)),
    })),
    Match.exhaustive
  );
}
