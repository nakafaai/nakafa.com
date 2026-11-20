import {
  linksOf,
  type Road,
  roadBetween,
  type Town,
} from "@repo/design-system/components/contents/mathematics/network/graph";
import {
  Array as Arr,
  MutableHashMap,
  MutableHashSet,
  Option,
  Order,
  Schema,
} from "effect";

/** The most routes the toolbar lists between the start and the end. */
export const MAX_ROUTES = 8;

/** A route through the network: the towns it passes, start to end. */
export type Route = readonly string[];

/** The shortest route and its length in kilometres. */
const ShortestSchema = Schema.Struct({
  length: Schema.Finite,
  route: Schema.Array(Schema.String),
});
type Shortest = typeof ShortestSchema.Type;

/** A route's place in the list and its length in kilometres, as the run orders them. */
const RankedSchema = Schema.Struct({
  index: Schema.Int,
  length: Schema.Finite,
});
type Ranked = typeof RankedSchema.Type;

/** A town Dijkstra's method has reached, and how far it lies from the start. */
const ReachedSchema = Schema.Struct({
  at: Schema.String,
  here: Schema.Finite,
});
type Reached = typeof ReachedSchema.Type;

/**
 * The simple routes from `start` to `end`, none passing a town twice, at most
 * `cap` of them. They come in a fixed order: each step tries the neighbours
 * in the order the town list gives them, so the order says nothing of length.
 */
export function simpleRoutes(
  towns: readonly Town[],
  roads: readonly Road[],
  start: string,
  end: string,
  cap: number
): readonly Route[] {
  const extend = (
    route: Route,
    at: string,
    found: readonly Route[]
  ): readonly Route[] =>
    at === end
      ? [...found, route]
      : Arr.reduce(linksOf(towns, roads, at), found, (done, link) =>
          done.length < cap && !Arr.contains(route, link.town)
            ? extend([...route, link.town], link.town, done)
            : done
        );
  return cap > 0 ? extend([start], start, []) : [];
}

/** The length of a route in kilometres: the sum of its roads. */
export function routeLength(roads: readonly Road[], route: Route) {
  return Arr.reduce(Arr.drop(route, 1), 0, (sum, town, index) =>
    Option.match(roadBetween(roads, Arr.getUnsafe(route, index), town), {
      onNone: () => sum,
      onSome: (road) => sum + road.length,
    })
  );
}

/** The lengths of a route's roads in order, as the footer adds them up. */
export function legLengths(roads: readonly Road[], route: Route) {
  return Arr.map(Arr.drop(route, 1), (town, index) =>
    Option.match(roadBetween(roads, Arr.getUnsafe(route, index), town), {
      onNone: () => 0,
      onSome: (road) => road.length,
    })
  );
}

/**
 * The shortest route from `start` to `end`, by Dijkstra's method. Of two
 * routes equally short it keeps the one found first, trying towns in list
 * order, so the answer is always the same.
 */
export function shortestRoute(
  towns: readonly Town[],
  roads: readonly Road[],
  start: string,
  end: string
): Option.Option<Shortest> {
  const distance = MutableHashMap.make([start, 0]);
  const previous = MutableHashMap.empty<string, string>();
  const settled = MutableHashSet.empty<string>();
  while (true) {
    const open = Arr.flatMap(towns, (town): readonly Reached[] =>
      MutableHashSet.has(settled, town.id)
        ? []
        : Option.match(MutableHashMap.get(distance, town.id), {
            onNone: () => [],
            onSome: (here) => [{ at: town.id, here }],
          })
    );
    const next = Arr.head(
      Arr.sort(
        open,
        Order.mapInput(Order.Number, (each: Reached) => each.here)
      )
    );
    if (Option.isNone(next)) {
      return Option.none();
    }
    const { at, here } = next.value;
    if (at === end) {
      return Option.some({ length: here, route: walkBack(previous, end) });
    }
    MutableHashSet.add(settled, at);
    for (const link of linksOf(towns, roads, at)) {
      const through = here + link.length;
      const known = Option.getOrElse(
        MutableHashMap.get(distance, link.town),
        () => Number.POSITIVE_INFINITY
      );
      if (through < known) {
        MutableHashMap.set(distance, link.town, through);
        MutableHashMap.set(previous, link.town, at);
      }
    }
  }
}

/** Follows each town back to the one it was reached from, to the start. */
function walkBack(
  previous: MutableHashMap.MutableHashMap<string, string>,
  at: string
): Route {
  return Option.match(MutableHashMap.get(previous, at), {
    onNone: () => [at],
    onSome: (before) => [...walkBack(previous, before), at],
  });
}

/** Whether two routes pass the same towns in the same order. */
function sameRoute(a: Route, b: Route) {
  return a.length === b.length && Arr.every(a, (town, at) => b[at] === town);
}

/**
 * The routes the toolbar offers: every simple route, or the first
 * `MAX_ROUTES` of them when there are more, with the shortest always among
 * them, so playing the routes always ends on it.
 */
export function routeChoices(
  towns: readonly Town[],
  roads: readonly Road[],
  start: string,
  end: string
): readonly Route[] {
  const routes = simpleRoutes(towns, roads, start, end, MAX_ROUTES);
  return Option.match(shortestRoute(towns, roads, start, end), {
    onNone: () => routes,
    onSome: ({ route }) =>
      Arr.some(routes, (each) => sameRoute(each, route))
        ? routes
        : [...Arr.take(routes, MAX_ROUTES - 1), route],
  });
}

/** The places of `routes`, longest first; of two equally long, the first listed goes first. */
export function longestFirst(roads: readonly Road[], routes: readonly Route[]) {
  const sorted = Arr.sort(
    Arr.map(
      routes,
      (route, index): Ranked => ({ index, length: routeLength(roads, route) })
    ),
    Order.combine(
      Order.mapInput(Order.flip(Order.Number), (each: Ranked) => each.length),
      Order.mapInput(Order.Number, (each: Ranked) => each.index)
    )
  );
  return Arr.map(sorted, (each) => each.index);
}
