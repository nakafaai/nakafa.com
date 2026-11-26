import { Match, Schema } from "effect";

const ContactStageSchema = Schema.Literals([
  "roasting",
  "catalyticOxidation",
  "oleumAbsorption",
  "dilution",
]);

export type ContactStage = typeof ContactStageSchema.Type;

const ContactUnitSchema = Schema.Struct({
  activeX: Schema.Finite,
  temperatureC: Schema.Int,
});

/** Locate active Contact-process plant unit and operating temperature by stage. */
export function evaluateContactStage(
  stage: ContactStage
): typeof ContactUnitSchema.Type {
  return Match.value(stage).pipe(
    Match.when("roasting", () => ({ activeX: -0.92, temperatureC: 1000 })),
    Match.when("catalyticOxidation", () => ({
      activeX: -0.32,
      temperatureC: 450,
    })),
    Match.when("oleumAbsorption", () => ({ activeX: 0.32, temperatureC: 120 })),
    Match.when("dilution", () => ({ activeX: 0.92, temperatureC: 60 })),
    Match.exhaustive
  );
}
