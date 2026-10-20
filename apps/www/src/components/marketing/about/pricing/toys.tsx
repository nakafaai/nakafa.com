"use client";

import { Thing } from "@repo/design-system/components/ui/thing";
import type { ThingName } from "@repo/mascot/thing/name";
import { ToyAnimal } from "@/components/marketing/about/toys/animal";
import { gap } from "@/components/marketing/about/toys/gap";
import {
  PRICING_SPARE_HERD,
  PRICING_TOY_HERD,
} from "@/components/marketing/about/toys/herd";
import {
  ToyOverlay,
  type ToyPlacement,
} from "@/components/marketing/about/toys/layer";
import { within } from "@/components/marketing/about/toys/place";

/** The distance from an animal to the thing beside it: a toy is 56px wide, with 14px between. */
const PAIR_OFFSET = 70;

/**
 * An animal and one thing beside it, in the open space above a part of the
 * page. The thing sits on the side that faces the middle of the page. `dy` is
 * how far the pair sits below the part's top edge: negative values stand in the
 * space above the part, and positive values in its top padding.
 */
function pair(
  part: string,
  x: number,
  index: number,
  name: ThingName,
  herd: typeof PRICING_TOY_HERD = PRICING_TOY_HERD,
  dy = -30
): readonly ToyPlacement[] {
  const offset = x < 0.5 ? PAIR_OFFSET : -PAIR_OFFSET;
  return [
    {
      key: `${part}-${index}-animal`,
      picture: <ToyAnimal herd={herd} index={index} />,
      place: within(part, { dy, minWidth: 1024, x, y: 0 }),
    },
    {
      key: `${part}-${index}-${name}`,
      picture: <Thing name={name} />,
      place: within(part, { dx: offset, dy, minWidth: 1024, x, y: 0 }),
    },
  ];
}

/**
 * The toys of the pricing page: in the middle of each part from the price to the
 * questions, a herd of two animals with their things at every width, and from
 * 1024 px two more pairs at its sides. The plans, which have no toys of their own
 * otherwise, take a pair in each top corner above the headline, an animal below
 * the cards and, from 1280 px, one at each side of them; the questions take one
 * more in their bottom padding. These come from the spare animals of the page.
 */
const PLACEMENTS: readonly ToyPlacement[] = [
  ...gap("comparison", 0.5, PRICING_TOY_HERD, [6, 7], ["ruler", "coffee"]),
  ...pair("comparison", 0.12, 0, "calculator"),
  ...pair("comparison", 0.84, 1, "donut"),
  ...gap("school", 0.5, PRICING_TOY_HERD, [8, 9], ["eraser", "flag"]),
  ...pair("school", 0.86, 2, "backpack"),
  ...pair("school", 0.1, 3, "cap"),
  ...gap("faq", 0.5, PRICING_TOY_HERD, [10, 11], ["clip", "hourglass"]),
  ...pair("faq", 0.14, 4, "bubble"),
  ...pair("faq", 0.82, 5, "magnifier"),
  ...pair("plans", 0.12, 0, "medal", PRICING_SPARE_HERD, 24),
  ...pair("plans", 0.86, 1, "trophy", PRICING_SPARE_HERD, 24),
  {
    key: "plans-below-animal",
    picture: <ToyAnimal herd={PRICING_SPARE_HERD} index={2} />,
    place: within("plans", { dx: -28, dy: -68, x: 0.5, y: 1 }),
  },
  // From 1280 px the plans also take an animal at each side of the cards, and
  // the questions take one in their bottom padding, at every width.
  {
    key: "plans-left-animal",
    picture: <ToyAnimal herd={PRICING_SPARE_HERD} index={3} />,
    place: within("plans", { dx: -28, minWidth: 1280, x: 0.03, y: 0.62 }),
  },
  {
    key: "plans-right-animal",
    picture: <ToyAnimal herd={PRICING_SPARE_HERD} index={4} />,
    place: within("plans", { dx: -28, minWidth: 1280, x: 0.97, y: 0.48 }),
  },
  {
    key: "faq-below-animal",
    picture: <ToyAnimal herd={PRICING_SPARE_HERD} index={5} />,
    place: within("faq", { dx: -28, dy: -68, x: 0.76, y: 1 }),
  },
];

/** The layer of toys laid over the pricing page, which renders its own parts. */
export function PricingToys() {
  return <ToyOverlay placements={PLACEMENTS} />;
}
