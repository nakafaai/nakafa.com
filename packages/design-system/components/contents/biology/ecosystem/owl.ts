import {
  lightInside,
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
 * A barn owl (Tyto alba) gliding, seen from above in the sun from the upper
 * left: about 95 cm across, so its wings stretch five rat lengths, golden
 * buff above with grey mottling and fine white spots, barred flight
 * feathers, and a pale heart-shaped face.
 */

/**
 * One barn owl wing, on `side` -1 or 1, as a closed outline: a straight
 * leading edge out to the wrist, a broad rounded hand, and a trailing edge
 * back to the body. `span` is the wingspan in pixels; the wing is a quarter
 * of the span deep at its middle, as a barn owl's broad wing is.
 */
function owlWing(sprite: p5.Graphics, span: number, side: number) {
  const at = (x: number, y: number) => [x * span, side * y * span] as const;
  sprite.beginShape();
  sprite.vertex(...at(0.075, 0.05));
  sprite.bezierVertex(...at(0.1, 0.13));
  sprite.bezierVertex(...at(0.11, 0.22));
  sprite.bezierVertex(...at(0.095, 0.29));
  sprite.bezierVertex(...at(0.08, 0.38));
  sprite.bezierVertex(...at(0.05, 0.47));
  sprite.bezierVertex(...at(0, 0.5));
  sprite.bezierVertex(...at(-0.05, 0.53));
  sprite.bezierVertex(...at(-0.11, 0.5));
  sprite.bezierVertex(...at(-0.13, 0.43));
  sprite.bezierVertex(...at(-0.17, 0.33));
  sprite.bezierVertex(...at(-0.17, 0.15));
  sprite.bezierVertex(...at(-0.13, 0.05));
  sprite.endShape(sprite.CLOSE);
}

/** A barn owl's body, its short fanned tail, and its large round head. */
function owlBody(sprite: p5.Graphics, span: number) {
  sprite.ellipse(-span * 0.02, 0, span * 0.34, span * 0.16);
  sprite.rect(
    -span * 0.25,
    -span * 0.065,
    span * 0.13,
    span * 0.13,
    span * 0.04
  );
  sprite.circle(span * 0.135, 0, span * 0.16);
}

/** A barn owl gliding, seen from above, its head forward along +x. */
export function owlSprite(sketch: p5, span: number) {
  const sprite = spriteOf(sketch, span * 0.55);
  sprite.fill(MATERIAL.owlWing);
  owlWing(sprite, span, -1);
  owlWing(sprite, span, 1);
  owlBody(sprite, span);
  lightInside(sprite, (drawing) => {
    const sun = drawing.createLinearGradient(
      -span * 0.3,
      -span * 0.5,
      span * 0.2,
      span * 0.5
    );
    sun.addColorStop(0, mix(MATERIAL.owlWing, MATERIAL.owlFace, 0.3));
    sun.addColorStop(0.5, MATERIAL.owlWing);
    sun.addColorStop(1, mix(MATERIAL.owlWing, MATERIAL.owlWingTip, 0.45));
    drawing.fillStyle = sun;
    drawing.fillRect(-span * 0.6, -span * 0.6, span * 1.2, span * 1.2);
    // The flight feathers along the trailing edge and in the hand are paler.
    const pale = drawing.createRadialGradient(
      0,
      0,
      span * 0.2,
      0,
      0,
      span * 0.55
    );
    pale.addColorStop(0, fade(MATERIAL.owlFace, 0));
    pale.addColorStop(1, fade(MATERIAL.owlFace, 0.35));
    drawing.fillStyle = pale;
    drawing.fillRect(-span * 0.6, -span * 0.6, span * 1.2, span * 1.2);
  });
  lightInside(sprite, () => {
    // Grey mottling over the coverts, the back and the crown.
    Arr.forEach(Arr.range(0, 140), (spot) => {
      const side = spot % 2 === 0 ? 1 : -1;
      const x = -0.16 + hashUnit(spot, 91) * 0.32;
      const y = hashUnit(spot, 92) * 0.32;
      sprite.fill(fade(MATERIAL.owlGrey, 0.3 + hashUnit(spot, 93) * 0.3));
      sprite.ellipse(
        x * span,
        side * y * span,
        span * (0.012 + hashUnit(spot, 94) * 0.02),
        span * (0.008 + hashUnit(spot, 95) * 0.012)
      );
    });
    sprite.noFill();
    sprite.strokeWeight(Math.max(0.5, span * 0.008));
    Arr.forEach([-1, 1], (side) => {
      // The primaries fan out from the wrist, each edged a shade darker.
      sprite.stroke(fade(MATERIAL.owlWingTip, 0.45));
      Arr.forEach(Arr.range(0, 6), (feather) => {
        const angle = side * (0.55 + feather * 0.3);
        sprite.line(
          span * 0.06,
          side * span * 0.3,
          span * (0.06 + Math.cos(angle) * 0.26),
          side * span * 0.3 + Math.sin(angle) * span * 0.26
        );
      });
      // Faint dark bars across the flight feathers.
      sprite.stroke(fade(MATERIAL.owlWingTip, 0.4));
      Arr.forEach(Arr.range(1, 4), (bar) => {
        const reach = (0.07 + bar * 0.04) * span * 2;
        sprite.arc(
          span * 0.06,
          side * span * 0.3,
          reach,
          reach,
          side > 0 ? 0.6 : -2.5,
          side > 0 ? 2.5 : -0.6
        );
        const back = (-0.1 - bar * 0.017) * span;
        sprite.line(back, side * span * 0.08, back, side * span * 0.32);
      });
    });
    sprite.noStroke();
    // Fine white spots, each with a black fleck, on the coverts and the back.
    Arr.forEach(Arr.range(0, 40), (spot) => {
      const side = spot % 2 === 0 ? 1 : -1;
      const x = (-0.1 + hashUnit(spot, 96) * 0.2) * span;
      const y = side * hashUnit(spot, 97) * 0.26 * span;
      sprite.fill(fade(MATERIAL.owlFace, 0.9));
      sprite.circle(x, y, Math.max(0.7, span * 0.01));
      sprite.fill(fade(MATERIAL.hairBlack, 0.8));
      sprite.circle(x - span * 0.005, y, Math.max(0.4, span * 0.005));
    });
  });
  owlFace(sprite, span);
  return sprite;
}

/** The pale heart-shaped facial disc, rimmed in buff, with small black eyes and a pale bill. */
function owlFace(sprite: p5.Graphics, span: number) {
  const at = (x: number, y: number) => [x * span, y * span] as const;
  sprite.fill(MATERIAL.owlFace);
  sprite.stroke(mix(MATERIAL.owlWing, MATERIAL.owlWingTip, 0.35));
  sprite.strokeWeight(Math.max(0.6, span * 0.007));
  sprite.beginShape();
  sprite.vertex(...at(0.13, 0));
  sprite.bezierVertex(...at(0.11, -0.03));
  sprite.bezierVertex(...at(0.12, -0.068));
  sprite.bezierVertex(...at(0.155, -0.06));
  sprite.bezierVertex(...at(0.185, -0.05));
  sprite.bezierVertex(...at(0.205, -0.022));
  sprite.bezierVertex(...at(0.212, 0));
  sprite.bezierVertex(...at(0.205, 0.022));
  sprite.bezierVertex(...at(0.185, 0.05));
  sprite.bezierVertex(...at(0.155, 0.06));
  sprite.bezierVertex(...at(0.12, 0.068));
  sprite.bezierVertex(...at(0.11, 0.03));
  sprite.bezierVertex(...at(0.13, 0));
  sprite.endShape(sprite.CLOSE);
  sprite.noStroke();
  // The disc dips toward the bill, a little shaded on the side away from the sun.
  sprite.fill(fade(MATERIAL.owlGrey, 0.25));
  sprite.ellipse(...at(0.168, 0.025), span * 0.05, span * 0.04);
  sprite.fill(MATERIAL.hairBlack);
  sprite.circle(...at(0.166, -0.024), span * 0.014);
  sprite.circle(...at(0.166, 0.024), span * 0.014);
  sprite.fill(MATERIAL.ratSkin);
  sprite.ellipse(...at(0.195, 0), span * 0.02, span * 0.01);
}

/** The soft shadow an owl casts on the field far below it. */
export function owlShadowSprite(sketch: p5, span: number) {
  const sprite = spriteOf(sketch, span * 0.55);
  shadowOnly(sprite, span * 0.05, 0.3, () => {
    owlWing(sprite, span, -1);
    owlWing(sprite, span, 1);
    owlBody(sprite, span);
  });
  return sprite;
}
