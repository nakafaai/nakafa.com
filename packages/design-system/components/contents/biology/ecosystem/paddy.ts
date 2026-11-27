import {
  createBackdrop,
  fade,
  gradientRect,
  mix,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { getColor } from "@repo/design-system/lib/color";
import { ECOLOGY_COLORS } from "@repo/design-system/lib/material/ecology";
import { ENERGY_COLORS } from "@repo/design-system/lib/material/energy";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { ROAD_COLORS } from "@repo/design-system/lib/material/road";
import { TOWN_COLORS } from "@repo/design-system/lib/material/town";
import { Array as Arr, Order } from "effect";
import type p5 from "p5";

/**
 * A rice field seen straight down from a drone in the morning sun, which
 * comes from the upper left: drained plots of damp, clodded soil with a few
 * puddles still holding the sky, rows of rice hills about 20 cm apart, each a
 * tuft of curved leaves over its own soft shadow, and raised earthen bunds
 * with grass on their edges between the plots. The field never moves, so it
 * paints once into a layer and is copied onto the canvas every frame.
 */

/** The varieties of rice hill stamped across the field, each turned at random. */
const HILL_KINDS = 6;

/** The 2D context under a p5 canvas or layer, which carries gradients. */
function context(sketch: p5) {
  const drawing = sketch.drawingContext;
  return drawing instanceof CanvasRenderingContext2D ? drawing : undefined;
}

/** The pixels between rice hills, about 20 cm in the field. */
export function hillSpacing(width: number) {
  return Math.min(15, Math.max(9, width / 80));
}

/** A painter that lays the field over the top `height` pixels of the canvas. */
export function createPaddy() {
  const backdrop = createBackdrop();
  return (sketch: p5, height: number) => {
    sketch.clear();
    backdrop(sketch, `paddy:${Math.round(height)}`, (layer) =>
      paintField(sketch, layer, height)
    );
  };
}

/**
 * The soil, the rice and the bunds, lit from the upper left. The rice hill
 * sprites come from `sketch`, since a layer cannot make layers of its own.
 */
function paintField(sketch: p5, layer: p5, height: number) {
  const width = layer.width;
  const spacing = hillSpacing(width);
  const bund = Math.max(7, width * 0.014);
  const plots = width > 560 ? 3 : 2;
  // Before its box is measured the canvas is a pixel wide, too small for a plot.
  if (width < bund * plots * 4 || height < bund * 4) {
    return;
  }
  // Nothing of the field, a bund's shadow or a grass tuft, spills off the canvas.
  layer.push();
  const drawing = context(layer);
  drawing?.beginPath();
  drawing?.rect(0, 0, width, height);
  drawing?.clip();
  paintSoil(layer, width, height);
  const hills = hillSprites(sketch, spacing);
  Arr.forEach(Arr.range(0, plots - 1), (plot) => {
    const left = (width / plots) * plot + bund / 2;
    const right = (width / plots) * (plot + 1) - bund / 2;
    const box = { bottom: height - bund, left, right, top: bund };
    paintPuddles(layer, box, plot);
    paintRice(layer, box, spacing, hills, plot);
  });
  Arr.forEach(hills, (hill) => {
    hill.remove();
  });
  Arr.forEach(Arr.range(0, plots), (edge) => {
    const x = Math.min(
      width - bund,
      Math.max(0, (width / plots) * edge - bund / 2)
    );
    paintBund(layer, { height, width: bund, x, y: 0 }, true);
  });
  paintBund(layer, { height: bund, width, x: 0, y: 0 }, false);
  paintBund(layer, { height: bund, width, x: 0, y: height - bund }, false);
  paintLight(layer, width, height);
  layer.pop();
}

/** Damp soil: dark mud under a scatter of lighter clods and darker hollows. */
function paintSoil(layer: p5, width: number, height: number) {
  layer.noStroke();
  layer.fill(mix(ECOLOGY_COLORS.mud, ECOLOGY_COLORS.leafLitterDark, 0.35));
  layer.rect(0, 0, width, height);
  const grains = Math.round((width * height) / 26);
  const shades = [
    fade(mix(ECOLOGY_COLORS.mud, TOWN_COLORS.riverbank, 0.35), 0.55),
    fade(ECOLOGY_COLORS.leafLitterDark, 0.5),
    fade(mix(ECOLOGY_COLORS.mud, ENERGY_COLORS.soil, 0.5), 0.6),
  ] as const;
  Arr.forEach(shades, (shade, kind) => {
    layer.fill(shade);
    Arr.forEach(Arr.range(0, grains - 1), (grain) => {
      if (Math.floor(hashUnit(grain, 31) * shades.length) !== kind) {
        return;
      }
      layer.circle(
        hashUnit(grain, 32) * width,
        hashUnit(grain, 33) * height,
        0.8 + hashUnit(grain, 34) * 2.2
      );
    });
  });
}

/** A few shallow puddles left in each plot, dark water showing the sky. */
function paintPuddles(
  layer: p5,
  box: { bottom: number; left: number; right: number; top: number },
  plot: number
) {
  const drawing = context(layer);
  if (!drawing) {
    return;
  }
  Arr.forEach(Arr.range(0, 3), (puddle) => {
    const salt = plot * 10 + puddle;
    const x = box.left + hashUnit(salt, 41) * (box.right - box.left);
    const y = box.top + hashUnit(salt, 42) * (box.bottom - box.top);
    const radius = (box.right - box.left) * (0.12 + hashUnit(salt, 43) * 0.18);
    drawing.save();
    drawing.translate(x, y);
    drawing.scale(1, 0.55 + hashUnit(salt, 44) * 0.3);
    drawing.rotate(hashUnit(salt, 45) * Math.PI);
    const water = drawing.createRadialGradient(
      -radius * 0.2,
      -radius * 0.2,
      radius * 0.05,
      0,
      0,
      radius
    );
    water.addColorStop(0, fade(TOWN_COLORS.waterGlint, 0.32));
    water.addColorStop(0.45, fade(TOWN_COLORS.water, 0.4));
    water.addColorStop(1, fade(TOWN_COLORS.waterDeep, 0));
    drawing.fillStyle = water;
    drawing.beginPath();
    drawing.arc(0, 0, radius, 0, Math.PI * 2);
    drawing.fill();
    drawing.restore();
  });
}

/**
 * Rice hills in straight rows, as a transplanter sets them: every hill's soft
 * shadow first, so no shadow falls on a neighbour's leaves, then the hills.
 */
function paintRice(
  layer: p5,
  box: { bottom: number; left: number; right: number; top: number },
  spacing: number,
  hills: readonly p5.Graphics[],
  plot: number
) {
  const drawing = context(layer);
  if (!drawing) {
    return;
  }
  const columns = Math.max(
    1,
    Math.floor((box.right - box.left) / (spacing * 1.35))
  );
  const rows = Math.max(
    1,
    Math.floor((box.bottom - box.top) / (spacing * 0.8))
  );
  const gapX = (box.right - box.left) / columns;
  const gapY = (box.bottom - box.top) / rows;
  const spots = Arr.flatMap(Arr.range(0, columns - 1), (column) =>
    Arr.map(Arr.range(0, rows - 1), (row) => {
      const salt = plot * 100_000 + column * 1000 + row;
      return {
        kind: Math.floor(hashUnit(salt, 51) * HILL_KINDS),
        turn: hashUnit(salt, 52) * Math.PI * 2,
        x:
          box.left +
          (column + 0.5) * gapX +
          (hashUnit(salt, 53) - 0.5) * gapX * 0.22,
        y:
          box.top +
          (row + 0.5) * gapY +
          (hashUnit(salt, 54) - 0.5) * gapY * 0.22,
      };
    })
  );
  const shadow = drawing.createRadialGradient(0, 0, 0, 0, 0, spacing * 0.55);
  shadow.addColorStop(0, fade(getColor("ZINC", 950), 0.42));
  shadow.addColorStop(1, fade(getColor("ZINC", 950), 0));
  Arr.forEach(spots, (spot) => {
    drawing.save();
    drawing.fillStyle = shadow;
    drawing.translate(spot.x + spacing * 0.2, spot.y + spacing * 0.26);
    drawing.fillRect(
      -spacing * 0.6,
      -spacing * 0.6,
      spacing * 1.2,
      spacing * 1.2
    );
    drawing.restore();
  });
  const half = spacing * 0.68;
  Arr.forEach(spots, (spot) => {
    const hill = hills[spot.kind];
    if (!hill) {
      return;
    }
    drawing.save();
    drawing.translate(spot.x, spot.y);
    drawing.rotate(spot.turn);
    drawing.drawImage(hill.elt, -half, -half, half * 2, half * 2);
    drawing.restore();
  });
}

/**
 * The kinds of rice hill, each a tuft of a dozen curved leaves fanning out
 * from its crown, the leaves facing the sun pale and those turned away dark.
 */
function hillSprites(sketch: p5, spacing: number) {
  const half = spacing * 0.68;
  return Arr.map(Arr.range(0, HILL_KINDS - 1), (kind) => {
    const hill = sketch.createGraphics(
      Math.ceil(half * 2),
      Math.ceil(half * 2)
    );
    hill.translate(half, half);
    hill.noFill();
    hill.strokeCap(hill.ROUND);
    const blades = Arr.sortWith(
      Arr.map(Arr.range(0, 15), (blade) => {
        const angle =
          (blade / 16) * Math.PI * 2 + (hashUnit(kind, blade) - 0.5) * 0.6;
        // Light comes from the upper left: a leaf pointing there is lit.
        const lit = (1 - Math.cos(angle + Math.PI * 0.75)) / 2;
        return {
          angle,
          bend: (hashUnit(kind, blade + 40) - 0.5) * 1.1,
          length: half * (0.62 + hashUnit(kind, blade + 20) * 0.36),
          lit: Math.min(
            1,
            Math.max(0, lit * 0.8 + hashUnit(kind, blade + 60) * 0.3)
          ),
        };
      }),
      (blade) => blade.lit,
      Order.Number
    );
    Arr.forEach(blades, (blade) => {
      const tipX = Math.cos(blade.angle) * blade.length;
      const tipY = Math.sin(blade.angle) * blade.length;
      const side = blade.angle + Math.PI / 2;
      const midX =
        tipX * 0.5 + Math.cos(side) * blade.bend * blade.length * 0.3;
      const midY =
        tipY * 0.5 + Math.sin(side) * blade.bend * blade.length * 0.3;
      const shade =
        blade.lit > 0.5
          ? mix(
              ECOLOGY_COLORS.riceLeaf,
              ECOLOGY_COLORS.riceLeafPale,
              (blade.lit - 0.5) * 1.6
            )
          : mix(
              ROAD_COLORS.foliageDark,
              ECOLOGY_COLORS.riceLeaf,
              blade.lit * 2
            );
      hill.stroke(shade);
      hill.strokeWeight(Math.max(0.7, spacing * 0.075));
      hill.bezier(0, 0, midX * 0.6, midY * 0.6, midX, midY, tipX, tipY);
    });
    hill.noStroke();
    hill.fill(ROAD_COLORS.foliageDark);
    hill.circle(0, 0, spacing * 0.16);
    return hill;
  });
}

/**
 * An earthen bund: a raised strip of packed soil, lit on its upper left face
 * and shaded on the lower right, casting a soft shadow onto the plot beside
 * it, with tufts of grass along both edges.
 */
function paintBund(
  layer: p5,
  box: { height: number; width: number; x: number; y: number },
  upright: boolean
) {
  const lit = mix(ENERGY_COLORS.soil, TOWN_COLORS.riverbank, 0.55);
  const top = mix(ENERGY_COLORS.soil, TOWN_COLORS.riverbank, 0.3);
  const shaded = mix(ENERGY_COLORS.soil, ECOLOGY_COLORS.leafLitterDark, 0.45);
  const cast = upright
    ? {
        height: box.height,
        width: box.width * 0.9,
        x: box.x + box.width,
        y: box.y,
      }
    : {
        height: box.height * 0.9,
        width: box.width,
        x: box.x,
        y: box.y + box.height,
      };
  gradientRect(
    layer,
    cast,
    [
      [0, fade(getColor("ZINC", 950), 0.38)],
      [1, fade(getColor("ZINC", 950), 0)],
    ],
    upright
  );
  gradientRect(
    layer,
    box,
    [
      [0, lit],
      [0.35, top],
      [0.7, top],
      [1, shaded],
    ],
    upright
  );
  const length = upright ? box.height : box.width;
  const depth = upright ? box.width : box.height;
  layer.noStroke();
  Arr.forEach(Arr.range(0, Math.round(length / 2.5)), (grain) => {
    const along = hashUnit(grain, upright ? 61 : 62) * length;
    const across = hashUnit(grain, upright ? 63 : 64) * depth;
    layer.fill(
      hashUnit(grain, 65) > 0.5
        ? fade(TOWN_COLORS.riverbank, 0.45)
        : fade(ECOLOGY_COLORS.leafLitterDark, 0.4)
    );
    layer.circle(
      upright ? box.x + across : box.x + along,
      upright ? box.y + along : box.y + across,
      0.8 + hashUnit(grain, 66) * 1.4
    );
  });
  layer.strokeWeight(1);
  Arr.forEach(Arr.range(0, Math.round(length / 3)), (tuft) => {
    const along = hashUnit(tuft, upright ? 71 : 72) * length;
    const edge = hashUnit(tuft, 73) > 0.5 ? depth * 0.08 : depth * 0.92;
    const lean = (hashUnit(tuft, 74) - 0.5) * 3;
    const reach = 2 + hashUnit(tuft, 75) * 3;
    layer.stroke(
      hashUnit(tuft, 76) > 0.4
        ? ROAD_COLORS.foliageLight
        : ROAD_COLORS.foliageShade
    );
    const x = upright ? box.x + edge : box.x + along;
    const y = upright ? box.y + along : box.y + edge;
    layer.line(
      x,
      y,
      x + (upright ? reach * Math.sign(edge - depth / 2) : lean),
      y + (upright ? lean : reach * Math.sign(edge - depth / 2))
    );
  });
  layer.noStroke();
}

/** Morning light across the field: warm at the upper left, falling off to the lower right. */
function paintLight(layer: p5, width: number, height: number) {
  const drawing = context(layer);
  if (!drawing) {
    return;
  }
  const light = drawing.createLinearGradient(0, 0, width, height);
  light.addColorStop(0, fade(INSTRUMENT_COLORS.lampLight, 0.14));
  light.addColorStop(0.5, fade(INSTRUMENT_COLORS.lampLight, 0));
  light.addColorStop(1, fade(getColor("ZINC", 950), 0.16));
  drawing.save();
  drawing.fillStyle = light;
  drawing.fillRect(0, 0, width, height);
  drawing.restore();
}
