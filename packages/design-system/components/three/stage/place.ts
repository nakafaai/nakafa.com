import type { Ground } from "@repo/design-system/components/three/stage/land";
import { Schema } from "effect";

/**
 * The places a lab can stand in. Five have something to stand on: a teaching
 * laboratory, a darkened optics room, an open field, the open sky over the
 * sea, and a photo studio. Four have no floor at all, because nothing in
 * them rests on one: open water or cytoplasm at the scale of a molecule, the
 * crowded inside of a cell or its nucleus, the lit field of a microscope,
 * and open space.
 */
export const PlaceSchema = Schema.Literals([
  "cell",
  "dark",
  "field",
  "lab",
  "microscope",
  "sky",
  "space",
  "studio",
  "water",
]);
export type Place = typeof PlaceSchema.Type;

/**
 * What a lab stands on in each place when it names a floor but not what the
 * floor is made of: the epoxy bench of a laboratory or an optics room, the
 * grass of a field, the maple table of a studio. A place with no entry has
 * nothing to stand on.
 */
const STANDS: Partial<Record<Place, Ground>> = {
  dark: "epoxy",
  field: "grass",
  lab: "epoxy",
  studio: "maple",
};

/**
 * What a lab stands on: the ground it names, else the ground of its place,
 * so no lab with a floor stands on a blank plane. A lab without a floor
 * stands on nothing, whatever it names.
 *
 * @param place - The place the lab stands in
 * @param floor - The height of the lab's floor, when it has one
 * @param ground - The ground the lab names, when it names one
 */
export function standsOn(
  place: Place,
  floor: number | undefined,
  ground: Ground | undefined
) {
  if (floor === undefined) {
    return;
  }
  return ground ?? STANDS[place];
}

/**
 * Packs a tone, its red, green and blue from 0 to 255, into the one number
 * a colour is read from, so a place states the tones of its light, depth
 * and drifting matter as the numbers they are.
 */
export function toneColor([red, green, blue]: readonly [
  red: number,
  green: number,
  blue: number,
]) {
  return red * 65_536 + green * 256 + blue;
}
