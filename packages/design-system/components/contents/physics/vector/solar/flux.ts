import { Schema } from "effect";

/**
 * A solar panel facing the sun's side of the sky. Sunlight arrives along
 * the sun's direction; the panel catches it through the area it shows the
 * sun, so the power is the dot product of the sunlight and the panel's area
 * vector: I A cos θ, with θ the angle between the panel's normal and the
 * direction to the sun. Tilted by β with the sun at elevation α in the same
 * vertical plane, θ is |90° − α − β|.
 */

/** The panel and the sky: area in m², sunlight in W/m², and the sun's elevation in degrees. */
export const PanelSchema = Schema.Struct({
  area: Schema.Finite.pipe(Schema.check(Schema.isGreaterThan(0))),
  elevation: Schema.Finite.pipe(
    Schema.check(Schema.isBetween({ maximum: 90, minimum: 0 }))
  ),
  sunlight: Schema.Finite.pipe(Schema.check(Schema.isGreaterThan(0))),
});
export type Panel = typeof PanelSchema.Type;

/** The angle between the normal and the sun, its cosine, and the power the panel catches, at a tilt in degrees. */
export function panelPower(panel: Panel, tilt: number) {
  const between = Math.abs(90 - panel.elevation - tilt);
  const cosine = Math.cos((between * Math.PI) / 180);
  return {
    between,
    cosine,
    power: Math.max(0, panel.sunlight * panel.area * cosine),
  };
}
