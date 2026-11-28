import type { Place } from "@repo/design-system/components/three/stage/place";
import { Schema } from "effect";

/** A linear colour as red, green and blue, before exposure and tone mapping. */
const ToneSchema = Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]);
export type Tone = typeof ToneSchema.Type;

/**
 * The air over an open place at one time of day: the light of its sun or
 * moon, the glow that light leaves in the sky, and the tone the far distance
 * takes. The sky that is drawn, the key light, the light the sky itself
 * throws, and the haze all read this one description, so they agree.
 */
const AirSchema = Schema.Struct({
  /** How much of the sky clouds cover, from 0 to 1. */
  cover: Schema.Finite,
  /** How strongly the sky itself lights the lab. */
  fill: Schema.Finite,
  /** The light that scatters in the air and gives the sky its colour. */
  glow: ToneSchema,
  /** The tone of the sky at the horizon, which the far distance fades into. */
  haze: ToneSchema,
  /** The colour of the key light after its way through the air. */
  light: ToneSchema,
  /** Whether the sun has set and the moon is the key light. */
  night: Schema.Boolean,
  /** How strong the key light is. */
  strength: Schema.Finite,
});
export type Air = typeof AirSchema.Type;

/** How much sea-level air scatters red, green and blue light, per metre (Rayleigh). */
const RAYLEIGH = [5.8e-6, 13.5e-6, 33.1e-6] as const;

/** How much the dust and droplets of clear air scatter light of any colour, per metre (Mie). */
const MIE = 4e-6;

/** How deep the air and its dust would stand at sea-level density, in metres. */
const RAYLEIGH_DEPTH = 8400;
const MIE_DEPTH = 1250;

/** How strongly dust scatters forward, toward the viewer who looks at the sun. */
const FORWARD = 0.76;

/** How much brighter the drawn sky is than the fraction of sunlight it scatters. */
const GAIN = 20;

/** How far above the horizon, as a sine, the sky's tone is read as the haze. */
const HAZE_HEIGHT = 0.09;

/** How much of the haze's colour the light scattered many times in thick air washes to white. */
const HAZE_WASH = 0.2;

/**
 * Sunlight before it enters the air, which the air scatters into the sky.
 * The key light is the same light after its way through the air.
 */
const SUN_ABOVE: Tone = [1, 1, 1];

/** Moonlight on a clear night, as a camera exposed for the night sees it. */
const MOONLIGHT: Tone = [0.62, 0.76, 1];

/** How much of the moon's light the night air scatters, against the day's. */
const NIGHT_GLOW = 0.16;

/** The last light of the set sun along the horizon. */
const DUSK: Tone = [0.15, 0.08, 0.075];

/** How fast the last light fades with height, and how much of it shows away from the set sun. */
const DUSK_FALL = 7;
const DUSK_FLOOR = 0.15;

/** Key and fill light of a clear day and of a moonlit dusk. */
const DAY = { cover: 0.3, fill: 1, strength: 3.2 };
const NIGHT = { cover: 0.3, fill: 1, strength: 2.6 };

/**
 * How many times more air light crosses toward a point at this height above
 * the horizon than straight up (Kasten and Young, 1989).
 *
 * @param sine - The sine of the height above the horizon
 */
export function airMass(sine: number) {
  const height = (Math.asin(Math.min(1, Math.max(0, sine))) * 180) / Math.PI;
  return (
    1 /
    (Math.sin((height * Math.PI) / 180) +
      0.505_72 * (height + 6.079_95) ** -1.6364)
  );
}

/**
 * The colour of sunlight after its way through the air: nearly white from
 * high up, yellow and then red as the sun sinks and its light crosses more
 * air. A camera balanced for daylight takes half of that warmth away, so the
 * brightest channel is always 1.
 *
 * @param sine - The sine of the sun's height above the horizon
 */
export function sunlight(sine: number): Tone {
  const mass = airMass(sine);
  const pass = (rayleigh: number) =>
    Math.sqrt(Math.exp(-(rayleigh * RAYLEIGH_DEPTH + MIE * MIE_DEPTH) * mass));
  const [red, green, blue] = [
    pass(RAYLEIGH[0]),
    pass(RAYLEIGH[1]),
    pass(RAYLEIGH[2]),
  ];
  return [1, green / red, blue / red];
}

/** How many times the depth of the air a line of sight at this height crosses. */
function sightPath(height: number) {
  const angle = (Math.acos(height) * 180) / Math.PI;
  return 1 / (height + 0.15 * (93.885 - angle) ** -1.253);
}

/**
 * The light the air scatters toward the viewer from one direction of a
 * clear sky: single scattering by air (Rayleigh) and dust (Mie) along the
 * line of sight. It is deep blue overhead, pale at the horizon, and bright
 * around the sun.
 *
 * @param height - The sine of the direction's height above the horizon
 * @param toward - The cosine of the angle between the direction and the sun
 * @param glow - The light that scatters
 */
export function skyGlow(height: number, toward: number, glow: Tone): Tone {
  const path = sightPath(Math.min(1, Math.max(0, height)));
  const air = (3 / (16 * Math.PI)) * (1 + toward * toward);
  const dust =
    (1 - FORWARD * FORWARD) /
    (4 * Math.PI * (1 + FORWARD * FORWARD - 2 * FORWARD * toward) ** 1.5);
  const channel = (rayleigh: number, light: number) =>
    ((GAIN * light * (rayleigh * air + MIE * dust)) / (rayleigh + MIE)) *
    (1 - Math.exp(-(rayleigh * RAYLEIGH_DEPTH + MIE * MIE_DEPTH) * path));
  return [
    channel(RAYLEIGH[0], glow[0]),
    channel(RAYLEIGH[1], glow[1]),
    channel(RAYLEIGH[2], glow[2]),
  ];
}

/**
 * The same sky for the graphics card: `airGlow` is `skyGlow`, and `duskGlow`
 * is the last light of the set sun, low along the horizon and strongest
 * where the sun went down. Both are written from the constants above, so the
 * drawn sky and the computed haze cannot drift apart.
 */
export const AIR_SHADER = `
vec3 airGlow(float height, float toward, vec3 glow) {
  float lifted = clamp(height, 0.0, 1.0);
  float path = 1.0 / (lifted + 0.15 * pow(93.885 - degrees(acos(lifted)), -1.253));
  vec3 rayleigh = vec3(${RAYLEIGH[0]}, ${RAYLEIGH[1]}, ${RAYLEIGH[2]});
  float air = ${3 / (16 * Math.PI)} * (1.0 + toward * toward);
  float dust = ${(1 - FORWARD * FORWARD) / (4 * Math.PI)} / pow(${1 + FORWARD * FORWARD} - ${2 * FORWARD} * toward, 1.5);
  vec3 lost = exp(-(rayleigh * ${RAYLEIGH_DEPTH}.0 + ${MIE * MIE_DEPTH}) * path);
  return ${GAIN}.0 * glow * (rayleigh * air + ${MIE} * dust) / (rayleigh + ${MIE}) * (1.0 - lost);
}
vec3 duskGlow(float height, float facing) {
  float turned = max(0.0, facing);
  return vec3(${DUSK[0]}, ${DUSK[1]}, ${DUSK[2]}) * exp(-${DUSK_FALL}.0 * max(0.0, height)) * (${DUSK_FLOOR} + ${1 - DUSK_FLOOR} * turned * turned);
}
`;

/** The tone of the sky just above the horizon, washed as thick air washes it. */
function hazeTone([red, green, blue]: Tone): Tone {
  const white = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  const washed = (value: number) => value + (white - value) * HAZE_WASH;
  return [washed(red), washed(green), washed(blue)];
}

/** Whether a place stands under the open sky, which the stage then draws and lights from. */
function isOpen(place: Place | undefined) {
  return place === "field" || place === "sky";
}

/**
 * The air over a place under the open sky: a clear day with fair-weather
 * clouds on a light page, and dusk running into a moonlit night on a dark
 * one, where the moon stands where the day's sun stood so shadows fall the
 * same way. A place with a roof, or with no sky at all, has no air to read.
 *
 * @param place - The place the lab stands in, when it stands in one
 * @param sun - The unit direction toward the place's sun
 * @param dark - Whether the page shows its dark theme
 */
export function openAir(
  place: Place | undefined,
  sun: Tone,
  dark: boolean
): Air | undefined {
  if (!isOpen(place)) {
    return;
  }
  if (dark) {
    const glow: Tone = [
      MOONLIGHT[0] * NIGHT_GLOW,
      MOONLIGHT[1] * NIGHT_GLOW,
      MOONLIGHT[2] * NIGHT_GLOW,
    ];
    const sky = skyGlow(HAZE_HEIGHT, 0, glow);
    const dusk = DUSK_FLOOR * Math.exp(-DUSK_FALL * HAZE_HEIGHT);
    return {
      ...NIGHT,
      glow,
      haze: hazeTone([
        sky[0] + DUSK[0] * dusk,
        sky[1] + DUSK[1] * dusk,
        sky[2] + DUSK[2] * dusk,
      ]),
      light: MOONLIGHT,
      night: true,
    };
  }
  return {
    ...DAY,
    glow: SUN_ABOVE,
    haze: hazeTone(skyGlow(HAZE_HEIGHT, 0, SUN_ABOVE)),
    light: sunlight(sun[1]),
    night: false,
  };
}
