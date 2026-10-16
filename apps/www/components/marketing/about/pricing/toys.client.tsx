"use client";

import { Animal } from "@repo/design-system/components/ui/animal";
import { Thing } from "@repo/design-system/components/ui/thing";
import type { ThingName } from "@repo/mascot/thing/name";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { PRICING_TOY_HERD } from "@/components/marketing/about/pricing/herd";
import {
  ToyLayer,
  type ToyPlacement,
} from "@/components/marketing/about/toys/layer.client";
import { within } from "@/components/marketing/about/toys/place";

/** The distance from an animal to the thing beside it: a toy is 56px wide, with 14px between. */
const PAIR_OFFSET = 70;

/** An animal of the cast, at its index in the slice that the toys take. */
function animal(index: number) {
  return (
    <Animal
      className="size-14"
      mascot={Arr.getUnsafe(PRICING_TOY_HERD, index)}
    />
  );
}

/** A thing of Nina's world, drawn at the size of a toy. */
function thing(name: ThingName) {
  return <Thing name={name} />;
}

/**
 * An animal and one thing beside it, in the open space above a part of the
 * page. The thing sits on the side that faces the middle of the page.
 */
function pair(
  part: string,
  x: number,
  index: number,
  name: ThingName
): readonly ToyPlacement[] {
  const offset = x < 0.5 ? PAIR_OFFSET : -PAIR_OFFSET;
  return [
    {
      key: `${part}-${index}-animal`,
      picture: animal(index),
      place: within(part, { dy: -30, minWidth: 1024, x, y: 0 }),
    },
    {
      key: `${part}-${index}-${name}`,
      picture: thing(name),
      place: within(part, { dx: offset, dy: -30, minWidth: 1024, x, y: 0 }),
    },
  ];
}

/** The toys of the pricing page: two pairs above each part from the price to the questions. */
const PLACEMENTS: readonly ToyPlacement[] = [
  ...pair("comparison", 0.12, 0, "calculator"),
  ...pair("comparison", 0.84, 1, "donut"),
  ...pair("school", 0.86, 2, "backpack"),
  ...pair("school", 0.1, 3, "cap"),
  ...pair("faq", 0.14, 4, "bubble"),
  ...pair("faq", 0.82, 5, "magnifier"),
];

/** The layer of toys over the whole pricing page. */
export function PricingToys({ children }: { children: ReactNode }) {
  return <ToyLayer placements={PLACEMENTS}>{children}</ToyLayer>;
}
