import {
  cellsAt,
  chanceAt,
  fractalAt,
  ridgedAt,
} from "@repo/design-system/components/three/field/noise";
import {
  fromStripe,
  held,
} from "@repo/design-system/components/three/surface/tile";

/** How many cusps a lathe tool leaves across one tile of machined metal. */
export const TURNS = 64;

/** How many turns of wire lie side by side across one tile of a winding. */
export const WIRES = 32;

/** Anodised aluminium: a satin etch over the faint lines of its extrusion. */
export function anodisedAt(x: number, y: number) {
  return {
    height:
      0.5 * fractalAt(x, y, 160, 160, 163, 1) +
      0.5 * fractalAt(x, y, 2, 128, 157, 2),
    shade: 0.75 + 0.25 * fractalAt(x, y, 6, 6, 167, 3),
  };
}

/** Brushed metal, streaked along its length. */
export function brushedAt(x: number, y: number) {
  const streaks = fractalAt(x, y, 3, 96, 3, 2);
  return {
    height: streaks,
    shade: 0.55 + 0.3 * streaks + 0.15 * fractalAt(x, y, 4, 4, 5, 3),
  };
}

/** Cast metal, finely pitted from its sand mould. */
export function castAt(x: number, y: number) {
  const grain = fractalAt(x, y, 56, 56, 127, 3);
  const pores = cellsAt(x, y, 36, 36, 131);
  const pore = pores.owner < 0.3 ? held(1 - pores.nearest * 3) : 0;
  return {
    height: 0.25 + 0.75 * grain - 0.5 * pore,
    shade: 0.6 + 0.4 * fractalAt(x, y, 8, 8, 137, 3) - 0.3 * pore,
  };
}

/** A knurl: a grid of small pyramids for a thumb to grip. */
export function knurlAt(x: number, y: number) {
  const peak = 1 - Math.max(fromStripe(x + y, 24), fromStripe(x - y, 24));
  return { height: peak, shade: 0.55 + 0.45 * peak };
}

/** Machined metal: the fine cusps a lathe tool leaves around a turned part. */
export function machinedAt(x: number, y: number) {
  const chatter = fractalAt(x, y, 6, 64, 211, 2);
  return {
    height: 0.85 * fromStripe(y, TURNS) ** 2 + 0.15 * chatter,
    shade: 0.7 + 0.2 * chatter + 0.1 * fractalAt(x, y, 4, 4, 213, 3),
  };
}

/** Polished metal: a mirror crossed by hairline scratches and dulled by smudges. */
export function polishedAt(x: number, y: number) {
  // Hairlines along the part and across it at a slant, each a thin crest of a ridged field, in the patches a cloth rubbed.
  const rubbed = held((fractalAt(x, y, 3, 3, 243, 2) - 0.5) * 6);
  const scratch =
    rubbed *
    Math.max(
      held((ridgedAt(x, y, 2, 40, 233, 1) - 0.8) / 0.2),
      held((ridgedAt(x + y, y, 2, 40, 239, 1) - 0.86) / 0.14)
    );
  return {
    height: 0.9 - 0.6 * scratch,
    shade: 0.72 + 0.28 * fractalAt(x, y, 5, 5, 241, 3) - 0.4 * scratch,
  };
}

/** A winding: round wire laid turn beside turn. */
export function windingAt(_x: number, y: number) {
  const wire = Math.cos((Math.PI / 2) * fromStripe(y, WIRES));
  return {
    height: wire,
    shade: 0.5 + 0.4 * wire + 0.1 * chanceAt(Math.floor(y * WIRES), 0, 251),
  };
}
