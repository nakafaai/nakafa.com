import { Match, Schema } from "effect";

const ParallelepipedConfigSchema = Schema.Literals([
  "orthogonalBox",
  "shearedPrism",
  "coplanarFlat",
]);

export type ParallelepipedConfig = typeof ParallelepipedConfigSchema.Type;

const TripleProductSchema = Schema.Struct({
  altitude: Schema.Finite,
  baseArea: Schema.Finite,
  coplanar: Schema.Boolean,
  volume: Schema.Finite,
});

/** Compute scalar triple product volume |w . (u x v)| for given configuration and elevation angle. */
export function evaluateParallelepiped(
  configuration: ParallelepipedConfig,
  elevationDeg: number
): typeof TripleProductSchema.Type {
  const rad = (Math.min(90, Math.max(0, elevationDeg)) * Math.PI) / 180;
  return Match.value(configuration).pipe(
    Match.when("orthogonalBox", () => {
      const altitude = 1.5 * Math.sin(rad);
      const baseArea = 3.0;
      const volume = baseArea * altitude;
      return {
        altitude: Number(altitude.toFixed(2)),
        baseArea,
        coplanar: volume < 0.05,
        volume: Number(volume.toFixed(2)),
      };
    }),
    Match.when("shearedPrism", () => {
      const altitude = 1.5 * Math.sin(rad) * 0.78;
      const baseArea = 2.4;
      const volume = baseArea * altitude;
      return {
        altitude: Number(altitude.toFixed(2)),
        baseArea,
        coplanar: volume < 0.05,
        volume: Number(volume.toFixed(2)),
      };
    }),
    Match.when("coplanarFlat", () => ({
      altitude: 0,
      baseArea: 2.4,
      coplanar: true,
      volume: 0,
    })),
    Match.exhaustive
  );
}
