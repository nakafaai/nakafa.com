import { Array as Arr, Match, Option, Schema } from "effect";

export const INCIDENTS = [
  "eye",
  "mercury",
  "culture",
  "glass",
  "fire",
] as const;

const IncidentSchema = Schema.Literals(INCIDENTS);
export type Incident = typeof IncidentSchema.Type;

const EYE_STAGES = ["alert", "open", "rinse", "help"] as const;
const MERCURY_STAGES = ["clear", "air", "gather", "sulfur", "seal"] as const;
const CULTURE_STAGES = ["alert", "cover", "soak", "collect"] as const;
const GLASS_STAGES = ["alert", "sweep", "box"] as const;
const FIRE_STAGES = ["gas", "smother", "extinguish", "leave"] as const;

type EyeStage = (typeof EYE_STAGES)[number];
type MercuryStage = (typeof MERCURY_STAGES)[number];
type CultureStage = (typeof CULTURE_STAGES)[number];
type GlassStage = (typeof GLASS_STAGES)[number];
type FireStage = (typeof FIRE_STAGES)[number];

export interface ResponseStepsMap<T> {
  readonly culture?: Readonly<Record<CultureStage, T>>;
  readonly eye?: Readonly<Record<EyeStage, T>>;
  readonly fire?: Readonly<Record<FireStage, T>>;
  readonly glass?: Readonly<Record<GlassStage, T>>;
  readonly mercury?: Readonly<Record<MercuryStage, T>>;
}

/** Ordered stage keys for each laboratory emergency incident. */
export function stagesOf(incident: Incident): readonly string[] {
  return Match.value(incident).pipe(
    Match.when("eye", () => EYE_STAGES),
    Match.when("mercury", () => MERCURY_STAGES),
    Match.when("culture", () => CULTURE_STAGES),
    Match.when("glass", () => GLASS_STAGES),
    Match.when("fire", () => FIRE_STAGES),
    Match.exhaustive
  );
}

/** Clamp a stage index to the valid bounds of the given incident. */
export function clampStage(incident: Incident, index: number): number {
  const max = stagesOf(incident).length - 1;
  return Math.max(0, Math.min(max, Math.round(index)));
}

/** Advance to the next stage index, wrapping back to zero after the final stage. */
export function nextStage(incident: Incident, index: number): number {
  const count = stagesOf(incident).length;
  return (clampStage(incident, index) + 1) % count;
}

/** Retrieve the localized stage instruction for the active incident and index. */
export function stageCopy<T>(
  incident: Incident,
  index: number,
  steps: ResponseStepsMap<T>
): Option.Option<T> {
  const safe = clampStage(incident, index);
  return Match.value(incident).pipe(
    Match.when("eye", () =>
      Option.flatMap(Arr.get(EYE_STAGES, safe), (key) =>
        Option.fromUndefinedOr(steps.eye?.[key])
      )
    ),
    Match.when("mercury", () =>
      Option.flatMap(Arr.get(MERCURY_STAGES, safe), (key) =>
        Option.fromUndefinedOr(steps.mercury?.[key])
      )
    ),
    Match.when("culture", () =>
      Option.flatMap(Arr.get(CULTURE_STAGES, safe), (key) =>
        Option.fromUndefinedOr(steps.culture?.[key])
      )
    ),
    Match.when("glass", () =>
      Option.flatMap(Arr.get(GLASS_STAGES, safe), (key) =>
        Option.fromUndefinedOr(steps.glass?.[key])
      )
    ),
    Match.when("fire", () =>
      Option.flatMap(Arr.get(FIRE_STAGES, safe), (key) =>
        Option.fromUndefinedOr(steps.fire?.[key])
      )
    ),
    Match.exhaustive
  );
}
