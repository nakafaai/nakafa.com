import { Match, Schema } from "effect";

const LiftForceSchema = Schema.Literals([
  "rootPressure",
  "capillary",
  "transpirationPull",
]);

export type LiftForce = typeof LiftForceSchema.Type;

const XylemLiftSchema = Schema.Struct({
  flowSpeed: Schema.Finite,
  maxReachMeters: Schema.Finite,
  pressureKpa: Schema.Finite,
  reachesTop: Schema.Boolean,
});

/**
 * Evaluate hydrostatic pressure needed to lift water to `heightMeters`
 * and whether the selected xylem lifting mechanism can reach the crown.
 */
export function evaluateXylemLift(
  force: LiftForce,
  heightMeters: number
): typeof XylemLiftSchema.Type {
  const h = Math.max(0.5, heightMeters);
  const pressureKpa = Number((h * 9.81).toFixed(1));
  const maxReachMeters = Match.value(force).pipe(
    Match.when("rootPressure", () => 3),
    Match.when("capillary", () => 1.5),
    Match.when("transpirationPull", () => 120),
    Match.exhaustive
  );
  const flowSpeed = Match.value(force).pipe(
    Match.when("rootPressure", () => 0.45),
    Match.when("capillary", () => 0.35),
    Match.when("transpirationPull", () => 1.35),
    Match.exhaustive
  );
  return {
    flowSpeed,
    maxReachMeters,
    pressureKpa,
    reachesTop: h <= maxReachMeters,
  };
}
