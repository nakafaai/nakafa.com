import { Array as Arr, Record, Result, Schema } from "effect";

/** The shelves the building tools sort things onto (ADR 0050, W2 and W7). */
export const Shelf = Schema.Literals(["nature", "building", "decor", "water"]);

/** What the catalogue holds for one thing: its shelf, and its price in Stars. */
const Entry = Schema.Struct({ price: Schema.Int, shelf: Shelf });

/**
 * Every thing a learner can set on their land (ADR 0050, W2), by its key. A
 * price of 0 is open from the first day; any other thing is built only after
 * the learner opened its blueprint for that many Stars, once (W5). A new thing
 * is one line here, and nothing else changes on the server.
 */
export const THINGS = {
  mango: { price: 0, shelf: "nature" },
  flame: { price: 15, shelf: "nature" },
  casuarina: { price: 10, shelf: "nature" },
  pine: { price: 10, shelf: "nature" },
  palm: { price: 15, shelf: "nature" },
  banana: { price: 10, shelf: "nature" },
  bush: { price: 0, shelf: "nature" },
  rocks: { price: 0, shelf: "nature" },
  sunflower: { price: 0, shelf: "nature" },
  cottage: { price: 40, shelf: "building" },
  saung: { price: 30, shelf: "building" },
  well: { price: 20, shelf: "building" },
  bridge: { price: 30, shelf: "building" },
  windmill: { price: 80, shelf: "building" },
  lighthouse: { price: 120, shelf: "building" },
  library: { price: 60, shelf: "building" },
  flowerbed: { price: 0, shelf: "decor" },
  lantern: { price: 0, shelf: "decor" },
  bench: { price: 0, shelf: "decor" },
  fence: { price: 0, shelf: "decor" },
  ball: { price: 0, shelf: "decor" },
  campfire: { price: 0, shelf: "decor" },
  kite: { price: 25, shelf: "decor" },
  balloon: { price: 150, shelf: "decor" },
  reed: { price: 0, shelf: "water" },
  lily: { price: 0, shelf: "water" },
  coral: { price: 0, shelf: "water" },
  brain: { price: 0, shelf: "water" },
  seagrass: { price: 0, shelf: "water" },
  boat: { price: 35, shelf: "water" },
} satisfies Record<string, typeof Entry.Type>;

/** The key of one thing of the catalogue. */
export const Thing = Schema.Literals(Record.keys(THINGS));
export type Thing = typeof Thing.Type;

/** The Stars that open a thing's blueprint, 0 for a thing open from the first day. */
export function priceOf(kind: Thing) {
  return THINGS[kind].price;
}

/** The Stars a learner spent on the blueprints they opened. */
export function spentOn(blueprints: readonly Thing[]) {
  return Arr.reduce(blueprints, 0, (total, kind) => total + priceOf(kind));
}

/**
 * The Stars a learner has left to open blueprints with (ADR 0050, W5): their
 * lifetime Stars less the price of every blueprint they opened, both read from
 * the server's own rows, and never below nothing.
 */
export function balanceOf(lifetime: number, blueprints: readonly Thing[]) {
  return Math.max(0, lifetime - spentOn(blueprints));
}

/** Whether a learner who opened these blueprints may build a thing. */
export function isOpen(kind: Thing, blueprints: readonly Thing[]) {
  return priceOf(kind) === 0 || Arr.contains(blueprints, kind);
}

/**
 * A blueprint the learner has too few Stars left to open: its price, and the
 * balance they hold.
 */
export class Short extends Schema.TaggedError<
  Short,
  { readonly brand: unique symbol }
>()("Short", { balance: Schema.Finite, price: Schema.Int }) {}

/**
 * The blueprints and the balance of a learner who opens one more (ADR 0050,
 * W5). A free thing and a blueprint already open change nothing; a price above
 * the balance is refused; otherwise the blueprint joins the ones opened, and
 * the balance falls by its price for good.
 */
export function openBlueprint(
  lifetime: number,
  blueprints: readonly Thing[],
  kind: Thing
) {
  const balance = balanceOf(lifetime, blueprints);
  if (isOpen(kind, blueprints)) {
    return Result.succeed({ balance, blueprints });
  }
  const price = priceOf(kind);
  return balance < price
    ? Result.fail(new Short({ balance, price }))
    : Result.succeed({
        balance: balance - price,
        blueprints: Arr.append(blueprints, kind),
      });
}
