import type {
  DyedAskSchema,
  MatterSchema,
  MetalSchema,
  NativeAskSchema,
} from "@repo/design-system/components/three/matter/ask";
import {
  isDyed,
  isMetal,
} from "@repo/design-system/components/three/matter/ask";
import { MATTER_COLORS } from "@repo/design-system/lib/material/matter";
import { Color } from "three";

/**
 * How far up the scale of heat each metal is ever run. A filament of
 * tungsten reaches white heat; nichrome is run no hotter than orange.
 */
const PEAKS: Record<typeof MetalSchema.Type, number> = {
  aluminium: 0.3,
  brass: 0.4,
  chrome: 0.6,
  copper: 0.5,
  gold: 0.5,
  iron: 0.6,
  nichrome: 0.6,
  nickel: 0.6,
  solder: 0.2,
  steel: 0.6,
  tungsten: 1,
};

/** How strongly a lit lamp or a glowing lens shines at a glow of 1. */
const SHINE = 2;

/**
 * The light a unit of area of a lit lamp or lens throws on what is around
 * it at a glow of 1, in candela a square scene unit.
 */
const CAST = 3.6;

/** How strongly a metal at white heat shines. */
const HEAT = 6;

/**
 * The light a unit of area of a metal at white heat throws on what is
 * around it, in candela a square scene unit.
 */
const BLAZE = 80;

/**
 * How steeply the light a hot metal throws falls as it cools. The visible
 * part of what a hot body radiates falls far faster than its heat, so a
 * heater coil at orange heat lights a bench no more than a lamp filament a
 * hundredth of its size.
 */
const STEEP = 6;

const RED_HEAT = new Color(MATTER_COLORS.heatRed);
const ORANGE_HEAT = new Color(MATTER_COLORS.heatOrange);
const WHITE_HEAT = new Color(MATTER_COLORS.heatWhite);

/** The colour a metal radiates at `heat`, from red heat at 0 through orange to white heat at 1. */
function radiance(heat: number) {
  const color = new Color();
  if (heat < 0.5) {
    color.copy(RED_HEAT).lerp(ORANGE_HEAT, heat * 2);
  } else {
    color.copy(ORANGE_HEAT).lerp(WHITE_HEAT, (heat - 0.5) * 2);
  }
  return `#${color.getHexString()}`;
}

/** A metal's glow as a share of the hottest it is ever run, from 0 (cold) to 1. */
export function hotness(glow: number | undefined) {
  return Math.min(1, Math.max(0, glow ?? 0));
}

/** The colour of what is not a metal: the one it was given, or its own. */
export function tintOf(
  ask: typeof DyedAskSchema.Type | typeof NativeAskSchema.Type
) {
  return isDyed(ask) ? ask.color : (ask.color ?? MATTER_COLORS[ask.of]);
}

/**
 * What a material radiates at its glow: the `color` and `strength` it shows
 * itself in, and the light each unit of its area `cast`s on what is around
 * it, in candela a square scene unit. All three come from the one glow, so
 * a filament and the pool of light under it always agree. A hot metal
 * radiates the colour of its heat; anything else is lit in its own colour,
 * and light itself shines unless it is told how brightly.
 */
export function matterGlow(ask: typeof MatterSchema.Type) {
  if (isMetal(ask)) {
    const glow = hotness(ask.glow);
    const heat = glow * PEAKS[ask.of];
    return {
      cast: heat ** STEEP * BLAZE,
      color: radiance(heat),
      strength: glow ** 1.5 * PEAKS[ask.of] ** 2 * HEAT,
    };
  }
  const glow = ask.glow ?? (ask.of === "light" ? 1 : 0);
  return {
    cast: Math.max(0, glow) * CAST,
    color: tintOf(ask),
    strength: glow * SHINE,
  };
}
