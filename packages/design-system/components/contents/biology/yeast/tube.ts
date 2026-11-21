import { Schema } from "effect";

/**
 * A round-bottomed glass tube: its outer diameter, its length from the foot
 * to the rim, and the thickness of its wall, all in metres.
 */
const TubeSchema = Schema.Struct({
  diameter: Schema.Finite,
  length: Schema.Finite,
  wall: Schema.Finite,
});
export type Tube = typeof TubeSchema.Type;

/**
 * The boiling tube of the practical, 25 × 150 mm with a 1.2 mm medium wall
 * (VWR medium-wall borosilicate test tubes, Avantor EU2005319), the same tube
 * the respirometer lab draws, so both experiments of the lesson share their
 * glassware. It holds 58 mL to the brim.
 */
export const BOILING_TUBE: Tube = {
  diameter: 0.025,
  length: 0.15,
  wall: 0.0012,
};

/**
 * The test tube that holds the limewater, 16 × 150 mm, which a catalogue
 * lists as holding 24 mL to the brim (Kimble KIMAX 45042-16150). A wall of
 * 0.8 mm gives that capacity.
 */
export const TEST_TUBE: Tube = {
  diameter: 0.016,
  length: 0.15,
  wall: 0.0008,
};

/** The radius of a tube's inside, in metres. */
export function innerRadius(tube: Tube) {
  return tube.diameter / 2 - tube.wall;
}

/** How many millilitres a cubic metre holds. */
const MILLILITRES = 1e6;

/**
 * The volume of liquid, in millilitres, that stands `level` metres above the
 * inside of a tube's round foot: a spherical cap while it is still in the
 * hemisphere, and the hemisphere and a cylinder above that.
 */
export function volumeAt(tube: Tube, level: number) {
  const radius = innerRadius(tube);
  if (level <= radius) {
    return ((Math.PI * level * level * (3 * radius - level)) / 3) * MILLILITRES;
  }
  const hemisphere = (2 / 3) * Math.PI * radius ** 3;
  return (hemisphere + Math.PI * radius ** 2 * (level - radius)) * MILLILITRES;
}

/**
 * How high `volume` millilitres stand in a tube, in metres above the inside
 * of its foot. Inside the hemisphere the cap's cubic is solved exactly by its
 * trigonometric root, so a small volume sits at its true depth.
 */
export function levelOf(tube: Tube, volume: number) {
  const radius = innerRadius(tube);
  const cubic = volume / MILLILITRES;
  const hemisphere = (2 / 3) * Math.PI * radius ** 3;
  if (cubic >= hemisphere) {
    return radius + (cubic - hemisphere) / (Math.PI * radius ** 2);
  }
  // h / r = 1 + 2 cos(arccos(1 - 3v / 2) / 3 - 2π / 3), with v = V / (π r³).
  const share = cubic / (Math.PI * radius ** 3);
  return (
    radius *
    (1 + 2 * Math.cos(Math.acos(1 - (3 * share) / 2) / 3 - (2 * Math.PI) / 3))
  );
}

/** What a tube holds filled to the brim, in millilitres. */
export function capacity(tube: Tube) {
  return volumeAt(tube, tube.length - tube.wall);
}

/**
 * The inside surface of a tube that `volume` millilitres wet, in square
 * metres. A spherical cap of height h has the area 2πrh, the same as the
 * cylinder wall of that height (Archimedes), so the foot and the wall above
 * it together wet 2πr times the level.
 */
export function wettedArea(tube: Tube, volume: number) {
  return 2 * Math.PI * innerRadius(tube) * levelOf(tube, volume);
}
