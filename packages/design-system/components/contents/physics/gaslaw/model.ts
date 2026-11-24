import { Match, Schema } from "effect";

const GasLawIdSchema = Schema.Literals(["boyle", "charles", "gayLussac"]);

export type GasLawId = typeof GasLawIdSchema.Type;

const GasLawReadingSchema = Schema.Struct({
  collisionIndex: Schema.Int,
  effectiveVolumeL: Schema.Finite,
  pressureKpa: Schema.Finite,
});

const REFERENCE_P_KPA = 101.3;
const REFERENCE_V_L = 10;
const REFERENCE_T_K = 300;

/**
 * Evaluate gas pressure (kPa), effective cylinder volume (L), and relative wall
 * collision index under Boyle's (T const), Charles's (P const), or Gay-Lussac's (V const) law.
 */
export function evaluateGasLaw(
  law: GasLawId,
  temperatureK: number,
  volumeL: number
): typeof GasLawReadingSchema.Type {
  const safeT = Math.max(50, temperatureK);
  const safeV = Math.max(1, volumeL);

  return Match.value(law).pipe(
    Match.when("boyle", () => {
      const pressureKpa = (REFERENCE_P_KPA * REFERENCE_V_L) / safeV;
      const collisionIndex = Math.round((pressureKpa / REFERENCE_P_KPA) * 100);
      return { collisionIndex, effectiveVolumeL: safeV, pressureKpa };
    }),
    Match.when("charles", () => {
      const effectiveVolumeL = (REFERENCE_V_L * safeT) / REFERENCE_T_K;
      const collisionIndex = Math.round(Math.sqrt(safeT / REFERENCE_T_K) * 100);
      return {
        collisionIndex,
        effectiveVolumeL,
        pressureKpa: REFERENCE_P_KPA,
      };
    }),
    Match.when("gayLussac", () => {
      const pressureKpa = (REFERENCE_P_KPA * safeT) / REFERENCE_T_K;
      const collisionIndex = Math.round((pressureKpa / REFERENCE_P_KPA) * 100);
      return {
        collisionIndex,
        effectiveVolumeL: REFERENCE_V_L,
        pressureKpa,
      };
    }),
    Match.exhaustive
  );
}
