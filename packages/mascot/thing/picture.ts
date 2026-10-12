import type { Shape } from "@repo/mascot/shape";
import { BAG } from "@repo/mascot/thing/bag";
import { DESK } from "@repo/mascot/thing/desk";
import { HELD } from "@repo/mascot/thing/held";
import type { Mark } from "@repo/mascot/thing/mark";
import type { ThingName } from "@repo/mascot/thing/name";
import { PRODUCT } from "@repo/mascot/thing/product";

/**
 * The picture of every thing, by name: a list of flat shapes on a 64 by 64
 * square. A name that has no picture does not compile.
 */
export const PICTURES: Record<ThingName, readonly Shape<Mark>[]> = {
  ...BAG,
  ...DESK,
  ...HELD,
  ...PRODUCT,
};
