import {
  fade,
  gradientRect,
  mix,
  outOfFocus,
  spotlight,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { getColor } from "@repo/design-system/lib/color";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import type p5 from "p5";

/**
 * The outdoor world the renewable-energy sketches share: a sky that falls off
 * toward a hazy horizon, a sun with its glare, hills the lens leaves out of
 * focus, ground and water. Plot hues and neutral shades are blended into the
 * tones of a landscape, because no other color may reach a lesson visual.
 */

/** The tones of the scenery, blended once from the plot and neutral palettes. */
export const SCENERY = {
  cloud: mix(getColor("SLATE", 50), getColor("WHITE"), 0.6),
  concrete: mix(getColor("STONE", 600), getColor("SLATE", 200), 0.55),
  grass: mix(PLOT_COLORS.teal, PLOT_COLORS.amber, 0.48),
  grassDark: mix(
    mix(PLOT_COLORS.teal, PLOT_COLORS.amber, 0.4),
    getColor("BLACK"),
    0.45
  ),
  haze: mix(getColor("SLATE", 200), PLOT_COLORS.teal, 0.14),
  rock: mix(getColor("STONE", 600), getColor("NEUTRAL", 800), 0.35),
  skyDay: mix(getColor("SLATE", 600), PLOT_COLORS.teal, 0.38),
  soil: mix(getColor("STONE", 600), PLOT_COLORS.orange, 0.28),
  steel: getColor("SLATE", 400),
  sun: mix(PLOT_COLORS.amber, getColor("WHITE"), 0.82),
  water: mix(PLOT_COLORS.teal, getColor("SLATE", 600), 0.45),
  waterLight: mix(PLOT_COLORS.teal, getColor("SLATE", 200), 0.55),
} as const;

/** How light the sky is: full day, the glow before sunset, or night. */
type Daylight = "day" | "dusk" | "night";

/** The top and horizon tones of each daylight. */
const SKY_TONES = {
  day: [SCENERY.skyDay, SCENERY.haze],
  dusk: [
    mix(getColor("SLATE", 800), PLOT_COLORS.violet, 0.35),
    mix(
      mix(PLOT_COLORS.orange, PLOT_COLORS.pink, 0.35),
      getColor("WHITE"),
      0.35
    ),
  ],
  night: [
    getColor("ZINC", 950),
    mix(getColor("SLATE", 800), PLOT_COLORS.violet, 0.2),
  ],
} as const satisfies Record<Daylight, readonly [string, string]>;

/** Paints the sky from the top of the frame down to the horizon. */
export function paintSky(
  sketch: p5,
  horizon: number,
  daylight: Daylight = "day"
) {
  const [top, low] = SKY_TONES[daylight];
  gradientRect(
    sketch,
    { height: horizon + 2, width: sketch.width, x: 0, y: 0 },
    [
      [0, top],
      [0.7, mix(top, low, 0.7)],
      [1, low],
    ]
  );
}

/** Paints the sun with its glare, which lights the sky around it. */
export function paintSun(
  sketch: p5,
  center: { readonly x: number; readonly y: number },
  radius: number,
  strength = 1
) {
  spotlight(sketch, center, radius * 9, {
    color: SCENERY.sun,
    strength: 0.42 * strength,
  });
  spotlight(sketch, center, radius * 2.4, {
    color: getColor("WHITE"),
    strength: 0.7 * strength,
  });
  sketch.noStroke();
  sketch.fill(fade(SCENERY.sun, Math.min(1, 0.35 + 0.65 * strength)));
  sketch.circle(center.x, center.y, radius * 2);
}

/**
 * Paints two ranges of far hills behind the horizon, blurred as a lens shows
 * what lies outside its focus, the far range paler in the haze.
 */
export function paintHills(
  sketch: p5,
  horizon: number,
  daylight: Daylight = "day"
) {
  const [, low] = SKY_TONES[daylight];
  const { width } = sketch;
  const ranges = [
    { amount: 0.72, height: 0.16, phase: 0.6, wave: 2.3 },
    { amount: 0.45, height: 0.1, phase: 2.1, wave: 3.7 },
  ] as const;
  outOfFocus(sketch, Math.max(1.5, width / 260), () => {
    for (const range of ranges) {
      sketch.noStroke();
      sketch.fill(mix(SCENERY.grassDark, low, range.amount));
      sketch.beginShape();
      sketch.vertex(-10, horizon + 4);
      for (let x = -10; x <= width + 10; x += 12) {
        const rise =
          Math.sin((x / width) * Math.PI * range.wave + range.phase) * 0.5 +
          Math.sin((x / width) * Math.PI * range.wave * 2.7 + range.phase) *
            0.18 +
          0.62;
        sketch.vertex(x, horizon - rise * range.height * horizon);
      }
      sketch.vertex(width + 10, horizon + 4);
      sketch.endShape(sketch.CLOSE);
    }
  });
}

/** Paints the ground from the horizon down, darker toward the viewer. */
export function paintGround(
  sketch: p5,
  horizon: number,
  tone: string = SCENERY.grass
) {
  gradientRect(
    sketch,
    { height: sketch.height - horizon, width: sketch.width, x: 0, y: horizon },
    [
      [0, mix(tone, SCENERY.haze, 0.35)],
      [0.35, tone],
      [1, mix(tone, getColor("BLACK"), 0.45)],
    ]
  );
}

/** Paints soft clouds that drift with `time`, in seconds. */
export function paintClouds(
  sketch: p5,
  horizon: number,
  time: number,
  opacity = 0.85
) {
  const { width } = sketch;
  const clouds = [
    { at: 0.12, high: 0.22, size: 0.16, speed: 6 },
    { at: 0.55, high: 0.12, size: 0.22, speed: 4 },
    { at: 0.86, high: 0.3, size: 0.12, speed: 8 },
  ] as const;
  outOfFocus(sketch, Math.max(2, width / 180), () => {
    sketch.noStroke();
    for (const cloud of clouds) {
      const span = width * 1.3;
      const x = ((cloud.at * span + time * cloud.speed) % span) - width * 0.15;
      const y = horizon * cloud.high;
      const size = width * cloud.size;
      sketch.fill(fade(SCENERY.cloud, opacity));
      sketch.ellipse(x, y, size, size * 0.34);
      sketch.ellipse(x + size * 0.22, y - size * 0.1, size * 0.6, size * 0.36);
      sketch.ellipse(x - size * 0.25, y - size * 0.04, size * 0.5, size * 0.26);
    }
  });
}
