import { squareFrame } from "@repo/design-system/components/contents/biology/epidemic/plaza";
import type { Walker } from "@repo/design-system/components/contents/biology/epidemic/spread";
import {
  fade,
  mix,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { getColor } from "@repo/design-system/lib/color";
import { MATERIAL } from "@repo/design-system/lib/material";
import { Array as Arr } from "effect";
import type p5 from "p5";

/**
 * People in the square seen from above: a head of dark hair over the
 * shoulders, the shirt in the colour of the person's state, so the legend
 * reads straight off the crowd, a pale mask band across the face of those who
 * wear one, and a soft shadow to the lower right. The figure is drawn a
 * little larger than life, about 1.25 m across the shoulders instead of half
 * that, so a shirt stays readable on a phone. Each kind of figure is painted
 * once into a sprite for its size and stamped turned along its walk.
 */

/** The shadows' ink and the figures' outline: near-black, faded where it is drawn. */
const SHADE = getColor("ZINC", 950);

/** The skin and hair of the people, so the crowd is not one person repeated. */
const LOOKS = [
  { hair: MATERIAL.hairBlack, skin: MATERIAL.skin },
  { hair: MATERIAL.hair, skin: MATERIAL.skinDeep },
  { hair: MATERIAL.hairBlack, skin: MATERIAL.skinDeep },
] as const;

/** The 2D context under a p5 canvas or layer, which carries gradients and shadows. */
function context(sketch: p5) {
  const drawing = sketch.drawingContext;
  return drawing instanceof CanvasRenderingContext2D ? drawing : undefined;
}

/**
 * A painter of the people out in the square, each in the shirt of `shirts`
 * that `shirtOf` picks for their index, the first `masked` of them in a mask.
 * Sprites are painted again only when the figure's size or the colours change.
 */
export function createCrowd(shirts: readonly string[]) {
  let built = -1;
  let figures: readonly p5.Graphics[] = [];
  let shadow: p5.Graphics | null = null;
  return (
    sketch: p5,
    walkers: readonly Walker[],
    shirtOf: (index: number) => number,
    masked: number
  ) => {
    const drawing = context(sketch);
    if (!drawing) {
      return;
    }
    const frame = squareFrame(sketch);
    const shoulders = Math.round(Math.max(8, frame.scale * 1.25) * 2) / 2;
    if (shoulders !== built || !shadow) {
      Arr.forEach(figures, (figure) => {
        figure.remove();
      });
      shadow?.remove();
      figures = Arr.flatMap(shirts, (shirt) =>
        Arr.flatMap([false, true], (mask) =>
          Arr.map(LOOKS, (look) =>
            figureSprite(sketch, shoulders, shirt, look, mask)
          )
        )
      );
      shadow = shadowSprite(sketch, shoulders);
      built = shoulders;
    }
    const half = shoulders * 0.8;
    const out = Arr.filter(
      Arr.map(walkers, (walker, index) => ({ index, walker })),
      ({ walker }) => !walker.home
    );
    Arr.forEach(out, ({ walker }) => {
      if (shadow) {
        stamp(
          drawing,
          shadow,
          frame.x(walker.x) + shoulders * 0.28,
          frame.y(walker.y) + shoulders * 0.36,
          walker.heading,
          half
        );
      }
    });
    Arr.forEach(out, ({ index, walker }) => {
      const kind =
        (shirtOf(index) * 2 + (index < masked ? 1 : 0)) * LOOKS.length +
        (index % LOOKS.length);
      const figure = figures[kind];
      if (figure) {
        stamp(
          drawing,
          figure,
          frame.x(walker.x),
          frame.y(walker.y),
          walker.heading,
          half
        );
      }
    });
  };
}

/** Draws a sprite centred on a point, turned to `heading`. */
function stamp(
  drawing: CanvasRenderingContext2D,
  sprite: p5.Graphics,
  x: number,
  y: number,
  heading: number,
  half: number
) {
  drawing.save();
  drawing.translate(x, y);
  drawing.rotate(heading);
  drawing.drawImage(sprite.elt, -half, -half, half * 2, half * 2);
  drawing.restore();
}

/** A square sprite for a figure `shoulders` pixels wide, its origin at the centre. */
function spriteOf(sketch: p5, shoulders: number) {
  const half = shoulders * 0.8;
  const sprite = sketch.createGraphics(
    Math.ceil(half * 2),
    Math.ceil(half * 2)
  );
  sprite.translate(half, half);
  sprite.noStroke();
  return sprite;
}

/** A figure's arms and shoulders from above, facing +x. */
function torsoShape(sprite: p5.Graphics, shoulders: number) {
  Arr.forEach([-1, 1], (side) => {
    sprite.ellipse(
      shoulders * 0.02,
      side * shoulders * 0.46,
      shoulders * 0.26,
      shoulders * 0.17
    );
  });
  sprite.ellipse(0, 0, shoulders * 0.5, shoulders * 0.92);
}

/**
 * One kind of figure: the shirt in its state colour, rounded by light that
 * falls off toward its edges, a thin dark outline that keeps it apart from
 * the paving, the head with skin at the face and hair over the crown, and a
 * mask band at the face when `mask` is set.
 */
function figureSprite(
  sketch: p5,
  shoulders: number,
  shirt: string,
  look: (typeof LOOKS)[number],
  mask: boolean
) {
  const sprite = spriteOf(sketch, shoulders);
  sprite.stroke(fade(SHADE, 0.4));
  sprite.strokeWeight(Math.max(0.7, shoulders * 0.07));
  sprite.fill(shirt);
  torsoShape(sprite, shoulders);
  sprite.noStroke();
  const drawing = context(sprite);
  if (drawing) {
    drawing.save();
    drawing.globalCompositeOperation = "source-atop";
    drawing.scale(0.55, 1);
    const fold = drawing.createRadialGradient(0, 0, 0, 0, 0, shoulders * 0.55);
    fold.addColorStop(0, mix(shirt, getColor("WHITE"), 0.22));
    fold.addColorStop(0.6, shirt);
    fold.addColorStop(1, mix(shirt, SHADE, 0.35));
    drawing.fillStyle = fold;
    drawing.fillRect(-shoulders * 2, -shoulders, shoulders * 4, shoulders * 2);
    drawing.restore();
  }
  const head = shoulders * 0.38;
  sprite.stroke(fade(SHADE, 0.45));
  sprite.strokeWeight(Math.max(0.5, shoulders * 0.045));
  sprite.fill(look.skin);
  sprite.circle(shoulders * 0.05, 0, head);
  sprite.noStroke();
  sprite.fill(look.hair);
  sprite.circle(-shoulders * 0.01, 0, head * 0.9);
  sprite.fill(fade(getColor("WHITE"), 0.18));
  sprite.ellipse(-shoulders * 0.04, -shoulders * 0.05, head * 0.4, head * 0.3);
  if (mask) {
    sprite.noFill();
    sprite.stroke(MATERIAL.surgicalMask);
    sprite.strokeWeight(Math.max(1, shoulders * 0.11));
    sprite.arc(shoulders * 0.05, 0, head * 0.86, head * 0.86, -1.05, 1.05);
    sprite.noStroke();
  }
  return sprite;
}

/** The soft shadow a figure casts on the paving. */
function shadowSprite(sketch: p5, shoulders: number) {
  const sprite = spriteOf(sketch, shoulders);
  const drawing = context(sprite);
  if (!drawing) {
    return sprite;
  }
  // The shapes go far off the sprite and their shadow, offset back, lands in it.
  const far = sprite.width * 4;
  const density = sprite.pixelDensity();
  sprite.push();
  drawing.shadowColor = fade(SHADE, 0.42);
  drawing.shadowBlur = shoulders * 0.18 * density;
  drawing.shadowOffsetX = far * density;
  sprite.translate(-far, 0);
  sprite.fill(SHADE);
  torsoShape(sprite, shoulders);
  sprite.circle(shoulders * 0.05, 0, shoulders * 0.38);
  sprite.pop();
  return sprite;
}
