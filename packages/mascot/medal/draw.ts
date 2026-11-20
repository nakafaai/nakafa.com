import { BRONZE, LID, NINA, POP, TEXT } from "@repo/mascot/color";
import type { MedalSchema } from "@repo/mascot/medal/name";
import { MEDALS } from "@repo/mascot/medal/name";
import { tenth } from "@repo/mascot/round";
import type { Shape } from "@repo/mascot/shape";
import { circle, group, path, polygon } from "@repo/mascot/shape";
import { sparkle } from "@repo/mascot/sparkle";
import { Array as Arr } from "effect";

/** The window a medal is drawn in: its disc on top, its ribbon under it. */
export const MEDAL_BOX = [0, 0, 120, 128] as const;

/** The metals a rim is cast in, a tier's three stars each: bronze, silver, gold. */
const METALS = [BRONZE, LID, POP.yellow] as const;
/** How many stars a medal collects before its rim changes. */
const STARS = 3;

/** A point of the medal's disc, `far` from its centre at a share of a full turn. */
function around(share: number, far: number) {
  const angle = share * Math.PI * 2;
  return {
    x: tenth(60 + Math.cos(angle) * far),
    y: tenth(54 + Math.sin(angle) * far),
  };
}

/** A rim of round scallops. */
function scallops(fill: string): readonly Shape[] {
  return Arr.makeBy(14, (index) => {
    const at = around(index / 14, 43);
    return circle({ cx: at.x, cy: at.y, fill, r: 10.5 });
  });
}

/** A rim of sixteen points, like a sun. */
function burst(fill: string): readonly Shape[] {
  const points = Arr.makeBy(32, (index) => {
    const at = around(index / 32, index % 2 === 0 ? 54 : 46);
    return `${at.x},${at.y}`;
  });
  return [
    polygon({
      fill,
      points: Arr.join(points, " "),
      stroke: fill,
      strokeLinejoin: "round",
      strokeWidth: 3,
    }),
  ];
}

/** A sun rim with a ring of beads on it. */
function crown(fill: string): readonly Shape[] {
  return [
    ...burst(fill),
    ...Arr.makeBy(16, (index) => {
      const at = around(index / 16, 45.4);
      return circle({ cx: at.x, cy: at.y, fill: NINA.ink, r: 1.7 });
    }),
  ];
}

/** The rims in the order a medal grows through them, once it holds every metal of the one before. */
const RIMS = [scallops, burst, crown] as const;

/** The two tails of the ribbon that hang under the disc. */
function ribbon(fill: string) {
  return [
    path({ d: "M34,84 L54,92 L50,126 L40,117 L30,123 Z", fill }),
    path({ d: "M86,84 L66,92 L70,126 L80,117 L90,123 Z", fill }),
  ];
}

/** The stars a tier holds, on the foot of the rim between the ribbon's tails. */
function stars(count: number): readonly Shape[] {
  return Arr.flatMap(
    Arr.makeBy(count, (index) => index),
    (index) => {
      const at = around(0.25 + (index - (count - 1) / 2) * 0.062, 44);
      return [
        circle({ cx: at.x, cy: at.y, fill: NINA.ink, r: 7.2 }),
        sparkle(at.x, at.y, 4.4, POP.yellow),
      ];
    }
  );
}

/**
 * Draws one medal at the tier a learner reached (ADR 0047, D30). At tier 0 it
 * is still to earn: every part takes the colour of the text round it, each
 * laid faintly over the ones under it, a quiet silhouette on any theme that
 * still shows what the emblem is. From tier 1 it shows in the
 * identity's colours, and the tier reads from the medal alone: one, two, then
 * three stars on its foot, a rim cast in bronze, silver, then gold for every
 * three tiers, and a richer rim once all three metals are held. Tiers have no
 * end, so the metals and rims come round again.
 */
export function medal(
  name: typeof MedalSchema.Type,
  tier: number
): readonly Shape[] {
  const design = MEDALS[name];
  if (tier < 1) {
    const mono = {
      dark: TEXT,
      first: TEXT,
      light: TEXT,
      second: TEXT,
      third: TEXT,
    };
    return [
      group(ribbon(TEXT), { opacity: 0.14 }),
      group(
        [...scallops(TEXT), circle({ cx: 60, cy: 54, fill: TEXT, r: 44 })],
        {
          opacity: 0.14,
        }
      ),
      ...Arr.map(design.emblem(mono), (shape) =>
        group([shape], { opacity: 0.26 })
      ),
    ];
  }
  const rank = Math.floor((tier - 1) / STARS);
  const rim = Arr.getUnsafe(
    RIMS,
    Math.floor(rank / METALS.length) % RIMS.length
  );
  return [
    ...ribbon(design.ribbon),
    ...rim(Arr.getUnsafe(METALS, rank % METALS.length)),
    circle({ cx: 60, cy: 54, fill: design.face, r: 40 }),
    ...design.emblem(design.ink),
    ...stars(((tier - 1) % STARS) + 1),
  ];
}
