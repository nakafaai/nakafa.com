import { Match, Schema } from "effect";

const TransportModeSchema = Schema.Literals([
  "simpleDiffusion",
  "facilitated",
  "activePump",
]);

export type TransportMode = typeof TransportModeSchema.Type;

const TransportDirectionSchema = Schema.Literals([
  "downGradient",
  "againstGradient",
]);

export type TransportDirection = typeof TransportDirectionSchema.Type;

const TransportReadingSchema = Schema.Struct({
  atpPerCycle: Schema.Int,
  direction: TransportDirectionSchema,
  fluxRate: Schema.Int,
});

/** Evaluate membrane transport direction, ATP demand, and relative solute flux. */
export function evaluateTransport(
  mode: TransportMode,
  gradientPercent: number
): typeof TransportReadingSchema.Type {
  const grad = Math.min(100, Math.max(0, gradientPercent));
  return Match.value(mode).pipe(
    Match.when("simpleDiffusion", () => ({
      atpPerCycle: 0,
      direction: "downGradient" as const,
      fluxRate: Math.round(grad * 0.65),
    })),
    Match.when("facilitated", () => ({
      atpPerCycle: 0,
      direction: "downGradient" as const,
      fluxRate: Math.min(95, Math.round(grad * 1.15)),
    })),
    Match.when("activePump", () => ({
      atpPerCycle: 1,
      direction: "againstGradient" as const,
      fluxRate: Math.round(45 + grad * 0.5),
    })),
    Match.exhaustive
  );
}
