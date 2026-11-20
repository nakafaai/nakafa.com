import { Array as Arr, Option, Order, Schema } from "effect";

/** One town of the network: the id its roads name, and the name on its sign. */
const TownSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
});
export type Town = typeof TownSchema.Type;

/** One road: the two towns it joins and its length in kilometres. */
const RoadSchema = Schema.Struct({
  from: Schema.String,
  length: Schema.Finite,
  to: Schema.String,
});
export type Road = typeof RoadSchema.Type;

/** A road seen from one of its towns: the road's place in the list, the town at its other end, its length. */
const LinkSchema = Schema.Struct({
  length: Schema.Finite,
  road: Schema.Int,
  town: Schema.String,
});
type Link = typeof LinkSchema.Type;

/** Where a town stands in the list, or the end of the list for a town not in it. */
function rankOf(towns: readonly Town[], id: string) {
  return Option.getOrElse(
    Arr.findFirstIndex(towns, (town) => town.id === id),
    () => towns.length
  );
}

/** The roads that leave `id`, in the order its neighbours stand in the town list. */
export function linksOf(
  towns: readonly Town[],
  roads: readonly Road[],
  id: string
): readonly Link[] {
  const links = Arr.flatMap(roads, (road, index): readonly Link[] => {
    if (road.from === id) {
      return [{ length: road.length, road: index, town: road.to }];
    }
    if (road.to === id) {
      return [{ length: road.length, road: index, town: road.from }];
    }
    return [];
  });
  return Arr.sort(
    links,
    Order.mapInput(Order.Number, (link: Link) => rankOf(towns, link.town))
  );
}

/** How many roads meet at a town: its degree. */
export function degreeOf(roads: readonly Road[], id: string) {
  return Arr.reduce(
    roads,
    0,
    (sum, road) => sum + Number(road.from === id) + Number(road.to === id)
  );
}

/** Every town's degree, in the order of the town list. */
export function degreesOf(towns: readonly Town[], roads: readonly Road[]) {
  return Arr.map(towns, (town) => degreeOf(roads, town.id));
}

/** The road joining two towns, whichever way it was listed. */
export function roadBetween(roads: readonly Road[], a: string, b: string) {
  return Arr.findFirst(
    roads,
    (road) =>
      (road.from === a && road.to === b) || (road.from === b && road.to === a)
  );
}
