import { Match, Schema } from "effect";

const LeChatelierSystemSchema = Schema.Literals([
  "haber",
  "nitrogenDioxide",
  "contact",
]);
export type LeChatelierSystem = typeof LeChatelierSystemSchema.Type;

const DisturbanceSchema = Schema.Literals([
  "pressure",
  "temperature",
  "concentration",
  "catalyst",
]);
export type Disturbance = typeof DisturbanceSchema.Type;

const ShiftDirectionSchema = Schema.Literals(["forward", "none", "reverse"]);
export type ShiftDirection = typeof ShiftDirectionSchema.Type;

const KcStateSchema = Schema.Literals(["increases", "constant", "decreases"]);
export type KcState = typeof KcStateSchema.Type;

const ResponseSchema = Schema.Struct({
  kcState: KcStateSchema,
  shift: ShiftDirectionSchema,
  yieldPercent: Schema.Int,
});

const SystemThermoSchema = Schema.Struct({
  baseYield: Schema.Finite,
  deltaGas: Schema.Int,
  exothermic: Schema.Boolean,
});

const SYSTEM_THERMO: Readonly<
  Record<LeChatelierSystem, typeof SystemThermoSchema.Type>
> = {
  contact: { baseYield: 68, deltaGas: -1, exothermic: true },
  haber: { baseYield: 52, deltaGas: -2, exothermic: true },
  nitrogenDioxide: { baseYield: 48, deltaGas: 1, exothermic: false },
};

/**
 * Predicts Le Chatelier shift direction, K_c response, and equilibrium product
 * yield for a chosen reaction system and disturbance level (`intensity` in
 * [-1, 1] where 0 is baseline; for catalyst > 0 means catalyst present).
 */
export function evaluateLeChatelier(
  system: LeChatelierSystem,
  disturbance: Disturbance,
  intensity: number
): typeof ResponseSchema.Type {
  const thermo = SYSTEM_THERMO[system];
  const clamped = Math.max(-1, Math.min(1, intensity));

  return Match.value(disturbance).pipe(
    Match.when("catalyst", () => ({
      kcState: "constant" as const,
      shift: "none" as const,
      yieldPercent: thermo.baseYield,
    })),
    Match.when("pressure", () => {
      if (Math.abs(clamped) < 0.08) {
        return {
          kcState: "constant" as const,
          shift: "none" as const,
          yieldPercent: thermo.baseYield,
        };
      }
      const forwardBoost = clamped * -thermo.deltaGas;
      const shift: ShiftDirection = forwardBoost > 0 ? "forward" : "reverse";
      return {
        kcState: "constant" as const,
        shift,
        yieldPercent: Math.round(
          Math.max(12, Math.min(94, thermo.baseYield + forwardBoost * 16))
        ),
      };
    }),
    Match.when("temperature", () => {
      if (Math.abs(clamped) < 0.08) {
        return {
          kcState: "constant" as const,
          shift: "none" as const,
          yieldPercent: thermo.baseYield,
        };
      }
      const forwardBoost = thermo.exothermic ? -clamped : clamped;
      const shift: ShiftDirection = forwardBoost > 0 ? "forward" : "reverse";
      const kcState: KcState = forwardBoost > 0 ? "increases" : "decreases";
      return {
        kcState,
        shift,
        yieldPercent: Math.round(
          Math.max(10, Math.min(92, thermo.baseYield + forwardBoost * 24))
        ),
      };
    }),
    Match.when("concentration", () => {
      if (Math.abs(clamped) < 0.08) {
        return {
          kcState: "constant" as const,
          shift: "none" as const,
          yieldPercent: thermo.baseYield,
        };
      }
      const shift: ShiftDirection = clamped > 0 ? "forward" : "reverse";
      return {
        kcState: "constant" as const,
        shift,
        yieldPercent: Math.round(
          Math.max(12, Math.min(92, thermo.baseYield + clamped * 20))
        ),
      };
    }),
    Match.exhaustive
  );
}
