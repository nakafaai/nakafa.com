import { Match, Schema } from "effect";

/**
 * A seedling lit from one side: left intact, its tip cut off, its tip under
 * an opaque cap, or a mica plate pushed in just below the tip on the shaded
 * or the lit side. Mica stops auxin moving down past it.
 */
const LightTreatmentSchema = Schema.Literals([
  "intact",
  "cut",
  "cap",
  "micaShade",
  "micaLit",
]);
export type LightTreatment = typeof LightTreatmentSchema.Type;

/**
 * A seedling laid on its side in the dark: left still, turned slowly on a
 * klinostat, or left still with its root cap removed.
 */
const GravityTreatmentSchema = Schema.Literals([
  "flat",
  "klinostat",
  "decapped",
]);
type GravityTreatment = typeof GravityTreatmentSchema.Type;

/**
 * The experiment a tropism lab runs: named seedlings lit from one side, or
 * named seedlings laid flat in the dark.
 */
const TropismSetupSchema = Schema.Union([
  Schema.Struct({
    seedlings: Schema.NonEmptyArray(
      Schema.Struct({ name: Schema.String, treatment: LightTreatmentSchema })
    ),
    stimulus: Schema.Literal("light"),
  }),
  Schema.Struct({
    seedlings: Schema.NonEmptyArray(
      Schema.Struct({ name: Schema.String, treatment: GravityTreatmentSchema })
    ),
    stimulus: Schema.Literal("gravity"),
  }),
]);
export type TropismSetup = typeof TropismSetupSchema.Type;

/** The organ of a seedling a reading follows. */
const OrganSchema = Schema.Literals(["shoot", "root"]);
export type Organ = typeof OrganSchema.Type;

/**
 * The auxin that reaches the elongating zone on the two sides of an organ, as
 * shares of what an intact tip makes: `far` on the side away from the
 * stimulus (the shaded side, or the upper side when laid flat) and `near` on
 * the side towards it (the lit side, or the lower side).
 */
const SplitSchema = Schema.Struct({
  far: Schema.Finite,
  near: Schema.Finite,
});
export type Split = typeof SplitSchema.Type;

/**
 * How a tip lit from one side shares its auxin: about two thirds moves to the
 * shaded side, as Briggs, Tocher and Wilson found in maize coleoptiles
 * ("Phototropic auxin redistribution in corn coleoptiles", Science, 1957).
 * Gravity sorts it the same way towards the lower side.
 */
const SHADED_SHARE = 0.65;

/** The even split of a tip that cannot tell where the stimulus comes from. */
const EVEN = { far: 0.5, near: 0.5 } as const;

/** The light-sorted split of an intact, lit tip: most auxin away from the light. */
const SORTED = { far: SHADED_SHARE, near: 1 - SHADED_SHARE } as const;

/** The gravity-sorted split of a seedling laid flat: most auxin on the lower side. */
const SETTLED = { far: 1 - SHADED_SHARE, near: SHADED_SHARE } as const;

/**
 * The auxin on the shaded and lit sides below the tip of a seedling lit from
 * one side. Mica on the shaded side leaves the shoot straight, as Boysen-Jensen
 * found ("La transmission de l'irritation phototropique dans l'Avena", 1913)
 * and the SPM textbooks teach: the lit tip has sent its auxin to the shaded
 * side, where the plate stops it, so neither side below elongates. Mica on the
 * lit side leaves the shaded path open, and the shoot bends towards the light.
 */
export function lightSplit(treatment: LightTreatment): Split {
  return Match.value(treatment).pipe(
    Match.when("intact", () => SORTED),
    Match.when("cut", () => ({ far: 0, near: 0 })),
    Match.when("cap", () => EVEN),
    Match.when("micaShade", () => ({ far: 0, near: 0 })),
    Match.when("micaLit", () => ({ far: SORTED.far, near: 0 })),
    Match.exhaustive
  );
}

/**
 * The auxin on the upper side (`far`) and lower side (`near`) of a seedling
 * laid flat. Left still, the root cap senses gravity and auxin collects
 * below; on a klinostat no side stays lower, so it spreads evenly; the shoot
 * of a decapped seedling still collects auxin below, but its root no longer
 * senses gravity.
 */
export function gravitySplit(treatment: GravityTreatment, organ: Organ): Split {
  return Match.value(treatment).pipe(
    Match.when("flat", () => SETTLED),
    Match.when("klinostat", () => EVEN),
    Match.when("decapped", () => (organ === "root" ? EVEN : SETTLED)),
    Match.exhaustive
  );
}

/** The most an organ curves in this lab's run, in radians, when one side has all the auxin and the other none. */
export const FULL_BEND = (2 * Math.PI) / 3;

/**
 * How far an organ has curved after `progress` of the run, from 0 to 1, in
 * radians towards the stimulus (a negative value curves away). A shoot side
 * grows faster with more auxin, so the shoot curves away from the side with
 * more; a root side grows slower with more, so the root curves towards it.
 */
export function bend(split: Split, organ: Organ, progress: number) {
  const lean = (split.far - split.near) * FULL_BEND * progress;
  return organ === "shoot" ? lean : -lean;
}

/**
 * How much an organ has grown after `progress` of the run, as a share of an
 * intact organ's growth: growth needs auxin, so an organ with none barely
 * lengthens, and an even split grows as fast as an intact one.
 */
export function growth(split: Split, progress: number) {
  return progress * Math.min(1, split.far + split.near);
}
