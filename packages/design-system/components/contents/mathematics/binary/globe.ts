import { Array as Arr } from "effect";

/**
 * The shape of a G45 globe bulb on an E27 screw cap, in metres from the foot
 * of the cap: a 45 mm sphere of clear glass on a short neck that narrows
 * onto the 27 mm cap (IEC 60061-1 E27 thread, about 26.5 mm across), with a
 * glass stem inside that carries two lead-in wires and, between their tips,
 * the coiled tungsten filament.
 */

/** The parts of the bulb, in metres. */
export const GLOBE = {
  /** The brass screw cap: its radius and the height it shows above the holder. */
  cap: { height: 0.012, radius: 0.0133 },
  /** Where the glass meets the cap, and its radius there. */
  neck: { radius: 0.0125, top: 0.008, waist: 0.0135 },
  /** The sphere of a G45 globe. */
  radius: 0.0225,
  /** The glass stem the lead-in wires rise through. */
  stem: { radius: 0.0022, top: 0.03 },
} as const;

/** The height of the sphere's centre above the foot of the cap. */
export const GLOBE_CENTRE =
  GLOBE.cap.height +
  GLOBE.neck.top +
  Math.sqrt(GLOBE.radius ** 2 - GLOBE.neck.waist ** 2);

/** The height of the top of the glass above the foot of the cap. */
export const GLOBE_HEIGHT = GLOBE_CENTRE + GLOBE.radius;

/** How many points draw the sphere's outline from the neck to the top. */
const ARC_POINTS = 28;

/**
 * The outline of the glass as (radius, height) pairs from the cap up to the
 * top, which a lathe turns into the envelope: the neck, then the sphere from
 * where it meets the neck to its pole.
 */
export function globeOutline() {
  const base = GLOBE.cap.height;
  const start = Math.asin(GLOBE.neck.waist / GLOBE.radius);
  const arc = Arr.map(Arr.range(0, ARC_POINTS), (step) => {
    const angle = start + ((Math.PI - start) * step) / ARC_POINTS;
    return [
      GLOBE.radius * Math.sin(angle),
      GLOBE_CENTRE - GLOBE.radius * Math.cos(angle),
    ] as const;
  });
  return Arr.appendAll(
    [
      [GLOBE.neck.radius, base] as const,
      [
        (GLOBE.neck.radius + GLOBE.neck.waist) / 2,
        base + GLOBE.neck.top / 2,
      ] as const,
    ],
    arc
  );
}

/** Where the lead-in wires leave the stem and where they hold the filament. */
export const LEADS = {
  foot: { height: GLOBE.cap.height + GLOBE.stem.top, spread: 0.0015 },
  tip: { height: GLOBE_CENTRE + 0.002, spread: 0.0085 },
} as const;

/** How many points draw the filament. */
const FILAMENT_POINTS = 24;

/**
 * The filament between the lead-in tips as [x, y] points: a coil that sags
 * over the support wire in the middle and rises to each tip, as the single
 * hairpin filament of a clear decorative globe hangs.
 */
export function filamentPath() {
  return Arr.map(Arr.range(0, FILAMENT_POINTS), (step) => {
    const along = step / FILAMENT_POINTS;
    const x = (along * 2 - 1) * LEADS.tip.spread;
    const lift = Math.sin(Math.PI * along) * 0.0045;
    return [x, LEADS.tip.height + lift] as const;
  });
}
