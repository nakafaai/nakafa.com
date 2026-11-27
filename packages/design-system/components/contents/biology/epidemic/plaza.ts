import { SQUARE } from "@repo/design-system/components/contents/biology/epidemic/spread";
import {
  paintCanopies,
  paintTreeShadows,
} from "@repo/design-system/components/contents/biology/epidemic/trees";
import {
  createBackdrop,
  fade,
  litBall,
  mix,
  withShadow,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { getColor } from "@repo/design-system/lib/color";
import { ECOLOGY_COLORS } from "@repo/design-system/lib/material/ecology";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { MACHINE_COLORS } from "@repo/design-system/lib/material/machine";
import { ROAD_COLORS } from "@repo/design-system/lib/material/road";
import { TOWN_COLORS } from "@repo/design-system/lib/material/town";
import { Array as Arr } from "effect";
import type p5 from "p5";

/**
 * The town square seen straight down in the morning sun, which comes from
 * the upper left: a mown lawn around a 60 m by 40 m plaza of sandstone pavers
 * in running bond inside a granite border, a ring of radial paving round a
 * stone fountain with water in its basin, and four shade trees whose layered
 * canopies cast soft shadows to the lower right. The ground paints once into
 * a layer and the canopies into another, drawn over the people walking under
 * them; only the fountain's ripples move.
 */

/** The fountain's basin: outer rim, water, and the pedestal in the middle, in metres. */
const FOUNTAIN = {
  pedestal: 0.9,
  rim: SQUARE.fountain,
  ring: 7.2,
  water: 4,
} as const;

/** The shadows' ink: near-black, faded where it is drawn. */
const SHADE = getColor("ZINC", 950);

/** The 2D context under a p5 canvas or layer, which carries gradients. */
function context(sketch: p5) {
  const drawing = sketch.drawingContext;
  return drawing instanceof CanvasRenderingContext2D ? drawing : undefined;
}

/** How the square's metres map onto the canvas, which the square and its lawn fill. */
export function squareFrame(sketch: p5) {
  const scale = Math.min(
    sketch.width / (SQUARE.width + 6),
    sketch.height / (SQUARE.depth + 6)
  );
  return {
    scale,
    x: (metres: number) => sketch.width / 2 + metres * scale,
    y: (metres: number) => sketch.height / 2 + metres * scale,
  };
}

/** The painters of the square: its ground under the people, and its tree canopies over them. */
export function createPlaza() {
  const ground = createBackdrop();
  const canopies = createBackdrop();
  return {
    canopies: (sketch: p5) => {
      const drawing = context(sketch);
      drawing?.save();
      // A canopy lets a little light through, so a person under it still shows.
      if (drawing) {
        drawing.globalAlpha = 0.93;
      }
      canopies(sketch, "canopies", (layer) => {
        const frame = squareFrame(layer);
        paintCanopies(layer, frame.x(0), frame.y(0), frame.scale);
      });
      drawing?.restore();
    },
    ground: (sketch: p5, seconds: number) => {
      sketch.clear();
      ground(sketch, "ground", paintGround);
      drawRipples(sketch, seconds);
    },
  };
}

/** The lawn, the paving, the tree shadows, the fountain and the light over them. */
function paintGround(layer: p5) {
  const frame = squareFrame(layer);
  paintLawn(layer, layer.width, layer.height, frame.scale);
  paintPavers(layer, frame);
  paintRing(layer, frame);
  paintBorder(layer, frame);
  paintTreeShadows(layer, frame.x(0), frame.y(0), frame.scale);
  paintFountain(layer, frame);
  paintSun(layer, layer.width, layer.height);
}

/** A mown lawn: grass in faint mowing stripes, flecked lighter and darker. */
function paintLawn(layer: p5, width: number, height: number, scale: number) {
  layer.noStroke();
  layer.fill(ROAD_COLORS.grass);
  layer.rect(0, 0, width, height);
  const stripe = scale * 2.5;
  layer.fill(fade(ROAD_COLORS.foliageLight, 0.35));
  Arr.forEach(Arr.range(0, Math.ceil(height / stripe / 2)), (band) => {
    layer.rect(0, band * stripe * 2, width, stripe);
  });
  const blades = Math.round((width * height) / 14);
  const shades = [
    fade(ROAD_COLORS.foliageDark, 0.55),
    fade(ECOLOGY_COLORS.riceLeafPale, 0.4),
    fade(ROAD_COLORS.foliageShade, 0.6),
  ] as const;
  Arr.forEach(shades, (shade, kind) => {
    layer.fill(shade);
    Arr.forEach(Arr.range(0, blades - 1), (blade) => {
      if (Math.floor(hashUnit(blade, 21) * shades.length) !== kind) {
        return;
      }
      layer.circle(
        hashUnit(blade, 22) * width,
        hashUnit(blade, 23) * height,
        0.7 + hashUnit(blade, 24) * 1.5
      );
    });
  });
}

/** Sandstone pavers in running bond, each a slightly different tone, set in darker joints. */
function paintPavers(layer: p5, frame: ReturnType<typeof squareFrame>) {
  const left = frame.x(-SQUARE.width / 2);
  const top = frame.y(-SQUARE.depth / 2);
  const width = SQUARE.width * frame.scale;
  const height = SQUARE.depth * frame.scale;
  layer.noStroke();
  layer.fill(mix(ROAD_COLORS.pavement, ECOLOGY_COLORS.granite, 0.45));
  layer.rect(left, top, width, height);
  const long = Math.max(9, frame.scale * 1.2);
  const short = long / 2;
  const joint = Math.max(0.6, frame.scale * 0.06);
  const rows = Math.ceil(height / short);
  const columns = Math.ceil(width / long) + 1;
  const tones = [
    ROAD_COLORS.pavement,
    mix(ROAD_COLORS.pavement, ECOLOGY_COLORS.stucco, 0.35),
    mix(ROAD_COLORS.pavement, TOWN_COLORS.riverbank, 0.3),
    mix(ROAD_COLORS.pavement, MACHINE_COLORS.concrete, 0.5),
  ] as const;
  Arr.forEach(tones, (tone, kind) => {
    layer.fill(tone);
    Arr.forEach(Arr.range(0, rows - 1), (row) => {
      const offset = row % 2 === 0 ? 0 : long / 2;
      Arr.forEach(Arr.range(0, columns - 1), (column) => {
        if (
          Math.floor(hashUnit(row * 977 + column, 25) * tones.length) !== kind
        ) {
          return;
        }
        const x = Math.max(left, left + column * long - offset);
        const right = Math.min(
          left + width,
          left + (column + 1) * long - offset
        );
        const bottom = Math.min(top + height, top + (row + 1) * short);
        if (right - x > joint) {
          layer.rect(
            x + joint / 2,
            top + row * short + joint / 2,
            right - x - joint,
            bottom - top - row * short - joint
          );
        }
      });
    });
  });
  // Weathering: faint darker patches where feet and rain have worn the stone.
  const drawing = context(layer);
  if (!drawing) {
    return;
  }
  Arr.forEach(Arr.range(0, 18), (patch) => {
    const x = left + hashUnit(patch, 26) * width;
    const y = top + hashUnit(patch, 27) * height;
    const radius = frame.scale * (2 + hashUnit(patch, 28) * 5);
    const wear = drawing.createRadialGradient(x, y, 0, x, y, radius);
    wear.addColorStop(0, fade(ECOLOGY_COLORS.granite, 0.12));
    wear.addColorStop(1, fade(ECOLOGY_COLORS.granite, 0));
    drawing.save();
    drawing.fillStyle = wear;
    drawing.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    drawing.restore();
  });
}

/** Radial paving round the fountain: rings of paler stone cut into wedges. */
function paintRing(layer: p5, frame: ReturnType<typeof squareFrame>) {
  const x = frame.x(0);
  const y = frame.y(0);
  layer.noStroke();
  layer.fill(mix(ECOLOGY_COLORS.stucco, ROAD_COLORS.pavement, 0.5));
  layer.circle(x, y, FOUNTAIN.ring * 2 * frame.scale);
  layer.noFill();
  layer.stroke(mix(ROAD_COLORS.pavement, ECOLOGY_COLORS.granite, 0.45));
  layer.strokeWeight(Math.max(0.6, frame.scale * 0.06));
  const rings = 4;
  Arr.forEach(Arr.range(0, rings), (ring) => {
    const radius =
      FOUNTAIN.rim + ((FOUNTAIN.ring - FOUNTAIN.rim) * ring) / rings;
    layer.circle(x, y, radius * 2 * frame.scale);
    const wedges = Math.round(radius * 5);
    if (ring === rings) {
      return;
    }
    const outer =
      FOUNTAIN.rim + ((FOUNTAIN.ring - FOUNTAIN.rim) * (ring + 1)) / rings;
    Arr.forEach(Arr.range(0, wedges - 1), (wedge) => {
      const angle = ((wedge + (ring % 2) * 0.5) / wedges) * Math.PI * 2;
      layer.line(
        x + Math.cos(angle) * radius * frame.scale,
        y + Math.sin(angle) * radius * frame.scale,
        x + Math.cos(angle) * outer * frame.scale,
        y + Math.sin(angle) * outer * frame.scale
      );
    });
  });
  layer.noStroke();
}

/** A border of dark granite setts along the plaza's edge, raised a little as a kerb. */
function paintBorder(layer: p5, frame: ReturnType<typeof squareFrame>) {
  const left = frame.x(-SQUARE.width / 2);
  const top = frame.y(-SQUARE.depth / 2);
  const width = SQUARE.width * frame.scale;
  const height = SQUARE.depth * frame.scale;
  const band = Math.max(3, frame.scale * 0.8);
  withShadow(
    layer,
    { blur: band, color: fade(SHADE, 0.35), drop: band * 0.4 },
    () => {
      layer.noFill();
      layer.stroke(ECOLOGY_COLORS.granite);
      layer.strokeWeight(band);
      layer.rect(left + band / 2, top + band / 2, width - band, height - band);
    }
  );
  layer.stroke(mix(ECOLOGY_COLORS.granite, ROAD_COLORS.kerb, 0.5));
  layer.strokeWeight(Math.max(0.6, band * 0.12));
  layer.rect(
    left + band * 0.1,
    top + band * 0.1,
    width - band * 0.2,
    height - band * 0.2
  );
  layer.noStroke();
}

/**
 * The fountain: a stone rim casting its shadow on the paving, water deep at
 * the middle and catching the sky at the upper left, and a stone pedestal
 * with its own small bowl.
 */
function paintFountain(layer: p5, frame: ReturnType<typeof squareFrame>) {
  const x = frame.x(0);
  const y = frame.y(0);
  const drawing = context(layer);
  withShadow(
    layer,
    {
      blur: frame.scale * 0.8,
      color: fade(SHADE, 0.45),
      drop: frame.scale * 0.35,
    },
    () => {
      layer.noStroke();
      layer.fill(MACHINE_COLORS.concrete);
      layer.circle(x, y, FOUNTAIN.rim * 2 * frame.scale);
    }
  );
  litBall(layer, { x, y }, FOUNTAIN.rim * frame.scale, {
    dark: mix(MACHINE_COLORS.concrete, ECOLOGY_COLORS.granite, 0.6),
    light: mix(MACHINE_COLORS.concrete, ECOLOGY_COLORS.stucco, 0.7),
  });
  if (!drawing) {
    return;
  }
  const radius = FOUNTAIN.water * frame.scale;
  const water = drawing.createRadialGradient(x, y, radius * 0.1, x, y, radius);
  water.addColorStop(0, TOWN_COLORS.waterDeep);
  water.addColorStop(0.75, TOWN_COLORS.water);
  water.addColorStop(1, mix(TOWN_COLORS.water, TOWN_COLORS.waterGlint, 0.25));
  drawing.save();
  drawing.fillStyle = water;
  drawing.beginPath();
  drawing.arc(x, y, radius, 0, Math.PI * 2);
  drawing.fill();
  // The rim shades the water on its sunward side.
  const rimShade = drawing.createLinearGradient(
    x - radius,
    y - radius,
    x + radius,
    y + radius
  );
  rimShade.addColorStop(0, fade(SHADE, 0.35));
  rimShade.addColorStop(0.35, fade(SHADE, 0));
  drawing.fillStyle = rimShade;
  drawing.fill();
  const sky = drawing.createRadialGradient(
    x - radius * 0.35,
    y + radius * 0.3,
    0,
    x - radius * 0.35,
    y + radius * 0.3,
    radius * 0.6
  );
  sky.addColorStop(0, fade(TOWN_COLORS.waterGlint, 0.3));
  sky.addColorStop(1, fade(TOWN_COLORS.waterGlint, 0));
  drawing.fillStyle = sky;
  drawing.fill();
  drawing.restore();
  withShadow(
    layer,
    {
      blur: frame.scale * 0.5,
      color: fade(SHADE, 0.5),
      drop: frame.scale * 0.3,
    },
    () => {
      layer.noStroke();
      layer.fill(MACHINE_COLORS.concrete);
      layer.circle(x, y, FOUNTAIN.pedestal * 2 * frame.scale);
    }
  );
  litBall(layer, { x, y }, FOUNTAIN.pedestal * frame.scale, {
    dark: mix(MACHINE_COLORS.concrete, ECOLOGY_COLORS.granite, 0.5),
    light: mix(MACHINE_COLORS.concrete, ECOLOGY_COLORS.stucco, 0.8),
  });
  layer.fill(TOWN_COLORS.water);
  layer.circle(x, y, FOUNTAIN.pedestal * 1.2 * frame.scale);
}

/** Morning light over the square: warm at the upper left, deeper at the lower right. */
function paintSun(layer: p5, width: number, height: number) {
  const drawing = context(layer);
  if (!drawing) {
    return;
  }
  const light = drawing.createLinearGradient(0, 0, width, height);
  light.addColorStop(0, fade(INSTRUMENT_COLORS.lampLight, 0.12));
  light.addColorStop(0.5, fade(INSTRUMENT_COLORS.lampLight, 0));
  light.addColorStop(1, fade(SHADE, 0.14));
  drawing.save();
  drawing.fillStyle = light;
  drawing.fillRect(0, 0, width, height);
  drawing.restore();
}

/** Ripples spreading from the fountain's jet across its basin, and the jet's spray. */
function drawRipples(sketch: p5, seconds: number) {
  const frame = squareFrame(sketch);
  const x = frame.x(0);
  const y = frame.y(0);
  sketch.noFill();
  sketch.strokeWeight(Math.max(0.8, frame.scale * 0.08));
  Arr.forEach(Arr.range(0, 2), (ripple) => {
    const phase = (seconds * 0.35 + ripple / 3) % 1;
    const radius =
      FOUNTAIN.pedestal + phase * (FOUNTAIN.water - FOUNTAIN.pedestal - 0.15);
    sketch.stroke(fade(TOWN_COLORS.waterGlint, 0.45 * (1 - phase)));
    sketch.circle(x, y, radius * 2 * frame.scale);
  });
  sketch.noStroke();
  Arr.forEach(Arr.range(0, 9), (drop) => {
    const phase = (seconds * 1.6 + hashUnit(drop, 36)) % 1;
    const angle = hashUnit(drop, 37) * Math.PI * 2;
    const reach = phase * FOUNTAIN.pedestal * 0.55 * frame.scale;
    sketch.fill(fade(TOWN_COLORS.waterGlint, 0.85 * (1 - phase)));
    sketch.circle(
      x + Math.cos(angle) * reach,
      y + Math.sin(angle) * reach,
      Math.max(1.2, frame.scale * 0.14)
    );
  });
  sketch.fill(fade(TOWN_COLORS.waterGlint, 0.9));
  sketch.circle(x, y, Math.max(2, frame.scale * 0.3));
}
