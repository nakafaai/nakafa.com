import {
  lightInside,
  SHADE,
  shadowOnly,
  spriteOf,
} from "@repo/design-system/components/contents/biology/ecosystem/sprite";
import {
  fade,
  mix,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { MATERIAL } from "@repo/design-system/lib/material";
import { Array as Arr } from "effect";
import type p5 from "p5";

/**
 * A rice-field rat (Rattus argentiventer) seen from above in the sun from the
 * upper left: a grizzled brown body about 18 cm long, paler along the spine,
 * pink ears and feet, and a dark scaly tail about as long again.
 */

/** A rat's body seen from above, nose along +x, `body` pixels from rump to nose. */
function ratBody(sprite: p5.Graphics, body: number) {
  sprite.ellipse(-body * 0.12, 0, body * 0.74, body * 0.46);
  sprite.ellipse(body * 0.14, 0, body * 0.52, body * 0.36);
  sprite.ellipse(body * 0.36, 0, body * 0.34, body * 0.25);
  sprite.ellipse(body * 0.5, 0, body * 0.2, body * 0.13);
}

/** A rat's tail, tapering from the rump and curling to one side by `curl`. */
function ratTail(sprite: p5.Graphics, body: number, curl: number) {
  const steps = 7;
  sprite.strokeCap(sprite.ROUND);
  Arr.forEach(Arr.range(0, steps - 1), (step) => {
    const at = (t: number) => ({
      x: -body * 0.42 - t * body * 0.9,
      y: curl * body * 0.22 * Math.sin(t * Math.PI * 0.95),
    });
    const from = at(step / steps);
    const to = at((step + 1) / steps);
    sprite.strokeWeight(body * (0.1 - (step / steps) * 0.07));
    sprite.line(from.x, from.y, to.x, to.y);
  });
  sprite.noStroke();
}

/** A rice-field rat: grizzled brown fur, paler at the spine, pink ears and feet, a dark scaly tail. */
export function ratSprite(sketch: p5, body: number, curl: number) {
  const sprite = spriteOf(sketch, body * 1.4);
  sprite.stroke(mix(MATERIAL.ratSkin, MATERIAL.leafLitterDark, 0.45));
  ratTail(sprite, body, curl);
  sprite.fill(MATERIAL.ratSkin);
  Arr.forEach([-1, 1], (side) => {
    sprite.ellipse(body * 0.24, side * body * 0.17, body * 0.1, body * 0.08);
    sprite.ellipse(-body * 0.3, side * body * 0.22, body * 0.13, body * 0.09);
  });
  sprite.fill(mix(MATERIAL.fur, MATERIAL.riverbank, 0.15));
  ratBody(sprite, body);
  lightInside(sprite, (drawing) => {
    drawing.scale(1, 0.5);
    const fur = drawing.createRadialGradient(
      -body * 0.05,
      -body * 0.08,
      body * 0.04,
      0,
      0,
      body * 0.6
    );
    fur.addColorStop(0, mix(MATERIAL.fur, MATERIAL.riverbank, 0.35));
    fur.addColorStop(0.55, mix(MATERIAL.fur, MATERIAL.leafLitterDark, 0.3));
    fur.addColorStop(1, mix(MATERIAL.fur, MATERIAL.leafLitterDark, 0.75));
    drawing.fillStyle = fur;
    drawing.fillRect(-body, -body * 2, body * 2, body * 4);
  });
  lightInside(sprite, () => {
    sprite.strokeWeight(Math.max(0.5, body * 0.035));
    Arr.forEach(Arr.range(0, 26), (hair) => {
      const x = (hashUnit(hair, curl + 81) - 0.55) * body * 0.9;
      const y = (hashUnit(hair, curl + 82) - 0.5) * body * 0.42;
      sprite.stroke(
        hashUnit(hair, 83) > 0.5
          ? fade(MATERIAL.riverbank, 0.45)
          : fade(MATERIAL.leafLitterDark, 0.5)
      );
      sprite.line(x, y, x - body * 0.08, y * 1.1);
    });
    sprite.noStroke();
  });
  Arr.forEach([-1, 1], (side) => {
    sprite.fill(mix(MATERIAL.ratSkin, MATERIAL.leafLitterDark, 0.35));
    sprite.ellipse(body * 0.29, side * body * 0.13, body * 0.13, body * 0.14);
    sprite.fill(MATERIAL.ratSkin);
    sprite.ellipse(body * 0.3, side * body * 0.13, body * 0.08, body * 0.09);
    sprite.fill(MATERIAL.hairBlack);
    sprite.circle(body * 0.42, side * body * 0.08, body * 0.055);
  });
  sprite.fill(mix(MATERIAL.ratSkin, MATERIAL.leafLitterDark, 0.2));
  sprite.circle(body * 0.6, 0, body * 0.05);
  return sprite;
}

/** The soft shadow a rat casts on the soil just under it. */
export function ratShadowSprite(sketch: p5, body: number) {
  const sprite = spriteOf(sketch, body * 1.4);
  shadowOnly(sprite, body * 0.12, 0.5, () => {
    ratBody(sprite, body);
    sprite.stroke(SHADE);
    ratTail(sprite, body, 0.4);
  });
  return sprite;
}
