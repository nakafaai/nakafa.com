import {
  fade,
  gradientRect,
  mix,
  outOfFocus,
  withShadow,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { getColor } from "@repo/design-system/lib/color";
import type p5 from "p5";

/**
 * A side view of a straight road at dusk, the stage of the kinematics
 * sketches: a soft sky, hills and a tree line out of focus behind, the road
 * sharp in front, and white posts at even distances, so a car's position can
 * be read against them.
 */

/** Where the road lies on the canvas and how metres map onto it. */
export type Road = {
  /** The canvas x of the road's zero, in pixels. */
  readonly origin: number;
  /** Pixels per metre along the road. */
  readonly scale: number;
  /** The canvas y of the road surface where the wheels stand. */
  readonly surface: number;
  /** The top of the scene band and its height, in pixels. */
  readonly top: number;
  readonly height: number;
};

/** The canvas x of a position on the road, in metres. */
export function roadX(road: Road, metres: number) {
  return road.origin + metres * road.scale;
}

/** A gentle ridge line made of a few sines, the same on every frame. */
function ridge(x: number, seed: number) {
  return (
    Math.sin(x * 0.006 + seed) * 0.5 +
    Math.sin(x * 0.017 + seed * 2.1) * 0.3 +
    Math.sin(x * 0.041 + seed * 3.7) * 0.2
  );
}

/** Paints the sky and the far landscape, blurred as a lens focused on the road shows them. */
export function paintLandscape(sketch: p5, road: Road) {
  const { width } = sketch;
  gradientRect(sketch, { height: road.height, width, x: 0, y: road.top }, [
    [0, mix(getColor("SLATE", 600), getColor("BLACK"), 0.15)],
    [0.55, getColor("SLATE", 400)],
    [1, mix(getColor("SLATE", 300), getColor("STONE", 600), 0.25)],
  ]);
  const horizon = road.surface - road.height * 0.18;
  outOfFocus(sketch, 3, () => {
    sketch.noStroke();
    sketch.fill(mix(getColor("SLATE", 600), getColor("SLATE", 400), 0.35));
    sketch.beginShape();
    sketch.vertex(0, road.surface);
    for (let x = 0; x <= width; x += 8) {
      sketch.vertex(x, horizon - road.height * 0.16 - ridge(x, 1.3) * road.height * 0.08);
    }
    sketch.vertex(width, road.surface);
    sketch.endShape(sketch.CLOSE);
    sketch.fill(mix(getColor("SLATE", 700), getColor("STONE", 600), 0.3));
    sketch.beginShape();
    sketch.vertex(0, road.surface);
    for (let x = 0; x <= width; x += 6) {
      sketch.vertex(x, horizon - Math.abs(ridge(x * 2.4, 4.2)) * road.height * 0.12);
    }
    sketch.vertex(width, road.surface);
    sketch.endShape(sketch.CLOSE);
  });
}

/**
 * Paints the road: verge, asphalt with its centre dashes, and a white post
 * every `postStep` metres from zero to `length`, the post at zero darker.
 */
export function paintRoad(
  sketch: p5,
  road: Road,
  posts: { readonly length: number; readonly step: number; readonly start?: number }
) {
  const { width } = sketch;
  const depth = road.height * 0.2;
  gradientRect(sketch, { height: depth * 0.35, width, x: 0, y: road.surface - depth * 0.35 }, [
    [0, mix(getColor("STONE", 600), getColor("SLATE", 600), 0.5)],
    [1, getColor("STONE", 600)],
  ]);
  gradientRect(sketch, { height: depth, width, x: 0, y: road.surface }, [
    [0, mix(getColor("ZINC", 900), getColor("SLATE", 600), 0.35)],
    [1, getColor("ZINC", 950)],
  ]);
  sketch.push();
  sketch.noStroke();
  sketch.fill(fade(getColor("ZINC", 100), 0.55));
  for (let x = -((road.origin % 60) + 60); x < width; x += 60) {
    sketch.rect(x, road.surface + depth * 0.5, 30, Math.max(2, depth * 0.06));
  }
  const first = posts.start ?? 0;
  for (let metres = first; metres <= posts.length + 1e-9; metres += posts.step) {
    const x = roadX(road, metres);
    const tall = depth * 0.9;
    withShadow(sketch, { blur: 6, color: fade(getColor("BLACK"), 0.5), drop: 2 }, () => {
      sketch.fill(Math.abs(metres) < 1e-9 ? getColor("ZINC", 100) : mix(getColor("ZINC", 100), getColor("SLATE", 400), 0.25));
      sketch.rect(x - 2.5, road.surface - tall, 5, tall);
    });
    sketch.fill(Math.abs(metres) < 1e-9 ? getColor("BLACK") : getColor("SLATE", 600));
    sketch.rect(x - 2.5, road.surface - tall, 5, tall * 0.18);
  }
  sketch.pop();
}

/**
 * Paints a car standing on the road with its rear at `rear`, facing right
 * (or left when `facing` is -1): body lit from above, glass, wheels with
 * rims, and its shadow on the asphalt.
 */
export function paintCar(
  sketch: p5,
  road: Road,
  car: { readonly color: string; readonly facing?: 1 | -1; readonly length: number; readonly rear: number }
) {
  const facing = car.facing ?? 1;
  const length = car.length;
  const wheel = length * 0.11;
  const bodyTop = road.surface - wheel * 1.05 - length * 0.2;
  const left = facing === 1 ? car.rear : car.rear - length;
  const part = (from: number, to: number) =>
    facing === 1 ? [left + length * from, left + length * to] : [left + length * (1 - to), left + length * (1 - from)];
  sketch.push();
  sketch.noStroke();
  sketch.fill(fade(getColor("BLACK"), 0.45));
  sketch.ellipse(left + length / 2, road.surface + 2, length * 1.1, wheel * 0.8);
  withShadow(sketch, { blur: 10, color: fade(getColor("BLACK"), 0.5), drop: 3 }, () => {
    sketch.fill(car.color);
    sketch.rect(left, bodyTop, length, length * 0.2, length * 0.05);
    const [cabinStart, cabinEnd] = part(0.24, 0.74);
    const [roofStart, roofEnd] = part(0.33, 0.66);
    sketch.quad(cabinStart, bodyTop + 1, roofStart, bodyTop - length * 0.16, roofEnd, bodyTop - length * 0.16, cabinEnd, bodyTop + 1);
  });
  sketch.fill(fade(getColor("WHITE"), 0.22));
  sketch.rect(left + length * 0.03, bodyTop + length * 0.02, length * 0.94, length * 0.035, length * 0.02);
  sketch.fill(mix(getColor("SLATE", 300), getColor("SLATE", 700), 0.45));
  const [glassStart, glassEnd] = part(0.29, 0.69);
  const [topStart, topEnd] = part(0.36, 0.63);
  sketch.quad(glassStart, bodyTop - 1, topStart, bodyTop - length * 0.135, topEnd, bodyTop - length * 0.135, glassEnd, bodyTop - 1);
  const [lampAt] = part(0.97, 1);
  sketch.fill(mix(getColor("ZINC", 100), getColor("STONE", 600), 0.1));
  sketch.rect(lampAt - length * 0.02, bodyTop + length * 0.05, length * 0.04, length * 0.04, 2);
  for (const at of [0.2, 0.8]) {
    const [x] = part(at, at);
    sketch.fill(getColor("ZINC", 950));
    sketch.circle(x, road.surface - wheel, wheel * 2);
    sketch.fill(getColor("SLATE", 400));
    sketch.circle(x, road.surface - wheel, wheel * 0.9);
    sketch.fill(getColor("SLATE", 700));
    sketch.circle(x, road.surface - wheel, wheel * 0.3);
  }
  sketch.pop();
}
