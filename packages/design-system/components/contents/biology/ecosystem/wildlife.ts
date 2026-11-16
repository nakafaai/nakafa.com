import {
  owlShadowSprite,
  owlSprite,
} from "@repo/design-system/components/contents/biology/ecosystem/owl";
import { hillSpacing } from "@repo/design-system/components/contents/biology/ecosystem/paddy";
import {
  ratShadowSprite,
  ratSprite,
} from "@repo/design-system/components/contents/biology/ecosystem/rat";
import {
  context,
  stamp,
} from "@repo/design-system/components/contents/biology/ecosystem/sprite";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { Array as Arr } from "effect";
import type p5 from "p5";

/**
 * The animals of the rice field seen from above, in the sun from the upper
 * left. A rice-field rat (Rattus argentiventer) is a grizzled brown body
 * about 18 cm long with a scaly tail as long again; a barn owl (Tyto alba)
 * spans about 95 cm, so its wings stretch five rat lengths, golden buff
 * above with grey mottling, barred flight feathers and a pale heart-shaped
 * face. Each is painted once into a sprite for its size and stamped turned
 * along its way on every frame, over a soft shadow: close under a rat, far
 * off under an owl gliding above the rice.
 */

/**
 * A painter of the field's animals: up to `rats` rats and `owls` owls
 * over the top `height` pixels of the canvas, `year` years into the run.
 * Sprites are painted again only when the canvas size changes.
 */
export function createWildlife() {
  let built = "";
  let sprites: ReturnType<typeof paintSprites> | null = null;
  return (
    sketch: p5,
    counts: { readonly owls: number; readonly rats: number },
    height: number,
    year: number
  ) => {
    const drawing = context(sketch);
    if (!drawing) {
      return;
    }
    // A rat is about as long as the rice hills are apart.
    const body = hillSpacing(sketch.width);
    const span = Math.min(
      58,
      Math.max(26, Math.min(sketch.width, height) * 0.1)
    );
    const id = `${body}:${span}`;
    if (!sprites || built !== id) {
      if (sprites) {
        Arr.forEach(
          [sprites.owl, sprites.owlShadow, sprites.ratShadow, ...sprites.rats],
          (sprite) => {
            sprite.remove();
          }
        );
      }
      sprites = paintSprites(sketch, body, span);
      built = id;
    }
    const { owl, owlShadow, ratShadow, rats } = sprites;
    const ratHalf = body * 1.4;
    const placed = Arr.map(
      Arr.range(0, Math.max(0, counts.rats - 1)),
      (rat) => {
        const phaseX = year * 6 + rat;
        const phaseY = year * 5 + rat;
        const reachY = height - ratHalf * 2;
        return {
          heading: Math.atan2(
            -Math.sin(phaseY) * 5 * reachY,
            Math.cos(phaseX) * 6 * sketch.width
          ),
          kind: rat % rats.length,
          x: (hashUnit(rat, 1) + 0.02 * Math.sin(phaseX)) * sketch.width,
          y: ratHalf + (hashUnit(rat, 2) + 0.02 * Math.cos(phaseY)) * reachY,
        };
      }
    );
    Arr.forEach(placed, (rat) => {
      stamp(
        drawing,
        ratShadow,
        rat.x + body * 0.12,
        rat.y + body * 0.16,
        rat.heading,
        ratHalf,
        1
      );
    });
    Arr.forEach(placed, (rat) => {
      const sprite = rats[rat.kind];
      if (sprite) {
        stamp(drawing, sprite, rat.x, rat.y, rat.heading, ratHalf, 1);
      }
    });
    const owlHalf = span * 0.55;
    // Each owl circles 30 px wide around a centre kept far enough inside the
    // field that its wings never cross onto the graph or off the canvas.
    const margin = 30 + owlHalf;
    const flying = Arr.map(
      Arr.range(0, Math.max(0, counts.owls - 1)),
      (bird) => {
        const angle =
          year * (1.2 + hashUnit(bird, 4)) + hashUnit(bird, 5) * Math.PI * 2;
        const cx =
          margin + hashUnit(bird, 6) * Math.max(0, sketch.width - margin * 2);
        const cy =
          margin + hashUnit(bird, 7) * Math.max(0, height - margin * 2);
        // A barn owl glides with a slow wingbeat now and then.
        const beat = Math.max(0, Math.sin(year * 9 + bird * 1.7)) ** 6;
        return {
          fold: 1 - beat * 0.22,
          heading: angle + Math.PI / 2,
          x: cx + Math.cos(angle) * 30,
          y: cy + Math.sin(angle) * 22,
        };
      }
    );
    Arr.forEach(flying, (bird) => {
      stamp(
        drawing,
        owlShadow,
        bird.x + span * 0.22,
        bird.y + span * 0.3,
        bird.heading,
        owlHalf,
        bird.fold
      );
    });
    Arr.forEach(flying, (bird) => {
      stamp(drawing, owl, bird.x, bird.y, bird.heading, owlHalf, bird.fold);
    });
  };
}

/** The sprites for rats `body` pixels long and owls `span` pixels across, with their shadows. */
function paintSprites(sketch: p5, body: number, span: number) {
  return {
    owl: owlSprite(sketch, span),
    owlShadow: owlShadowSprite(sketch, span),
    ratShadow: ratShadowSprite(sketch, body),
    rats: Arr.map([-1, 1, 0.4], (curl) => ratSprite(sketch, body, curl)),
  };
}
