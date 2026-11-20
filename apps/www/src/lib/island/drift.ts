import type { Season } from "@/lib/island/season";
import { leafToneOf } from "@/lib/island/season";

/**
 * How each season drifts from the crowns (ADR 0047, D41): the share of the
 * crowns that let a leaf go, and the tone of the season's leaves it falls in.
 * Autumn sheds most, in its orange; spring drops blossom, the pink highlight
 * of its leaves; the dry season sheds some; summer and the wet season let a
 * green leaf go now and then; winter's crowns hold nothing.
 */
const SHED = {
  autumn: { share: 0.35, tone: 2 },
  dry: { share: 0.15, tone: 2 },
  spring: { share: 0.2, tone: 3 },
  summer: { share: 0.05, tone: 2 },
  wet: { share: 0.05, tone: 2 },
  winter: { share: 0, tone: 2 },
} as const satisfies Record<Season, unknown>;

/** How much a season sheds and the color it sheds in, from 0 to 1. */
export function shedOf(season: Season) {
  const { share, tone } = SHED[season];
  const [red, green, blue] = leafToneOf(season, tone);
  return { color: [red / 255, green / 255, blue / 255] as const, share };
}
