import { Match, Schema } from "effect";

const JointKindSchema = Schema.Literals([
  "suture",
  "disc",
  "hinge",
  "ballSocket",
]);
export type JointKind = typeof JointKindSchema.Type;

const JointPartSchema = Schema.Literals([
  "bone",
  "cartilage",
  "membrane",
  "fluid",
  "ligament",
  "tendon",
  "muscle",
]);
export type JointPart = typeof JointPartSchema.Type;

const JointMotionSchema = Schema.Struct({
  pitchRad: Schema.Finite,
  rollRad: Schema.Finite,
  yawRad: Schema.Finite,
});
type JointMotion = typeof JointMotionSchema.Type;

/**
 * Computes physically constrained rotation angles (radians) for a joint given
 * a normalized learner slider input in [0, 1].
 */
export function jointAnglesAt(kind: JointKind, input: number): JointMotion {
  const t = Math.min(1, Math.max(0, input));
  const centered = (t - 0.5) * 2;
  return Match.value(kind).pipe(
    Match.when("suture", () => ({ pitchRad: 0, rollRad: 0, yawRad: 0 })),
    Match.when("disc", () => ({
      pitchRad: centered * 0.2,
      rollRad: centered * 0.08,
      yawRad: 0,
    })),
    Match.when("hinge", () => ({
      pitchRad: 0,
      rollRad: t * 2.15,
      yawRad: 0,
    })),
    Match.when("ballSocket", () => ({
      pitchRad: Math.sin(t * Math.PI * 2) * 0.72,
      rollRad: Math.cos(t * Math.PI * 2) * 0.58 + 0.45,
      yawRad: centered * 0.85,
    })),
    Match.exhaustive
  );
}
