import {
  originFor,
  POUR_TILT,
  VESSELS,
} from "@repo/design-system/components/contents/biology/waste/pour";
import type { Point } from "@repo/design-system/components/contents/biology/waste/station";
import {
  add,
  BOTTLE,
  CONTAINER,
  FUNNEL_TOP,
  GLASS_BOX,
  PointSchema,
  SHARPS,
  SINK,
  TRAY,
} from "@repo/design-system/components/contents/biology/waste/station";
import { Array as Arr, Option, Schema } from "effect";

/** The waste a school laboratory sorts, in the order of the Visual Catalog's closed list. */
const WasteSchema = Schema.Literals([
  "culture",
  "glove",
  "swab",
  "blade",
  "slide",
  "glass",
  "salt",
  "solvent",
]);
export type Waste = typeof WasteSchema.Type;

/** The five places waste leaves the bench by. */
const PlaceSchema = Schema.Literals([
  "sink",
  "chemical",
  "sharps",
  "glassBox",
  "biohazard",
]);
export type Place = typeof PlaceSchema.Type;

/**
 * Where each kind of waste goes. Anything that carries live microorganisms
 * (a culture, and a glove or swab that touched one) goes into an autoclave
 * bag and through the autoclave; anything that can pierce skin or a bag and
 * may carry them (a scalpel blade, a used slide) into the sharps container;
 * clean broken glass into its own box; a dilute, water-soluble, non-toxic
 * solution down the sink with plenty of running water; an organic solvent
 * into a labelled chemical waste bottle, never the drain.
 *
 * @see https://www.who.int/publications/i/item/9789240011359 (WHO Laboratory biosafety manual, 4th edition, monograph: decontamination and waste management)
 * @see https://www.nationalacademies.org/read/12654/chapter/10 (Prudent Practices in the Laboratory, 2011, chapter 8: drain disposal only for water-soluble, low-toxicity substances)
 */
const PLACES = {
  blade: "sharps",
  culture: "biohazard",
  glass: "glassBox",
  glove: "biohazard",
  salt: "sink",
  slide: "sharps",
  solvent: "chemical",
  swab: "biohazard",
} as const satisfies Record<Waste, Place>;

/** The place `item` leaves the bench by. */
export function placeOf(item: Waste): Place {
  return PLACES[item];
}

/** Whether `item` goes through the autoclave before it leaves the laboratory. */
export function throughAutoclave(item: Waste) {
  return placeOf(item) === "biohazard";
}

/** The beaker poured into each place a liquid goes. */
const POURS = { chemical: VESSELS.solvent, sink: VESSELS.salt } as const;

/** Whether waste reaches `place` poured from a beaker rather than dropped in. */
export function isPouredInto(place: Place): place is keyof typeof POURS {
  return place === "sink" || place === "chemical";
}

/**
 * Where each beaker's lip sits while it pours: over the sink's bowl, clear
 * of the tap's stream, and just above the funnel in the waste bottle.
 */
const SPOUTS = {
  chemical: [BOTTLE.at[0], FUNNEL_TOP + 0.02, BOTTLE.at[2] + 0.008],
  sink: [SINK.at[0] + 0.08, 0.1, SINK.at[2] + 0.03],
} as const satisfies Record<keyof typeof POURS, Point>;

/** Where a poured liquid's stream ends: on the floor of the sink's bowl, or in the throat of the funnel. */
const STREAM_ENDS = {
  chemical: FUNNEL_TOP - 0.04,
  sink: 0.003 - SINK.depth,
} as const satisfies Record<keyof typeof POURS, number>;

/** The beaker of a liquid that goes to `place`, and where its stream ends, when the place takes a poured liquid. */
export function pourOf(place: Place) {
  return isPouredInto(place)
    ? Option.some({ end: STREAM_ENDS[place], vessel: POURS[place] })
    : Option.none();
}

/** What an item does along its route, in order. */
const LegSchema = Schema.Struct({
  from: Schema.Finite,
  kind: Schema.Literals([
    "lift",
    "carry",
    "drop",
    "tip",
    "pour",
    "pause",
    "open",
    "load",
    "close",
    "heat",
  ]),
  to: Schema.Finite,
});
export type Leg = typeof LegSchema.Type;

/** How long each leg lasts, in seconds; a carry takes as long as its distance needs. */
const SECONDS = {
  close: 0.7,
  drop: 0.45,
  heat: 3.2,
  lift: 0.35,
  load: 1.8,
  open: 0.7,
  pause: 0.3,
  pour: 1.2,
  tip: 0.7,
} as const;

/** The legs after the carry, for each place. */
const FINISH = {
  biohazard: ["drop", "pause", "open", "load", "close", "heat"],
  chemical: ["tip", "pour"],
  glassBox: ["drop"],
  sharps: ["drop"],
  sink: ["tip", "pour"],
} as const satisfies Record<Place, readonly Leg["kind"][]>;

/** How fast an item is carried, in metres a second, and the longest and shortest carry, in seconds. */
const CARRY = { longest: 1.6, shortest: 0.8, speed: 0.6 } as const;

/** How high an item rises off the tray before it is carried, and how far above its way it arcs, in metres. */
export const RISE = { arc: 0.1, lift: 0.06 } as const;

/** The route one item takes from its slot on the tray to its place. */
const RouteSchema = Schema.Struct({
  entry: PointSchema,
  item: WasteSchema,
  legs: Schema.Array(LegSchema),
  lifted: PointSchema,
  place: PlaceSchema,
  rest: PointSchema,
  start: PointSchema,
});
export type Route = typeof RouteSchema.Type;

/**
 * Where the item in `index` of `count` waits on the tray: in rows of at most
 * four, from the back left, each in the middle of its own cell.
 */
export function slotOf(index: number, count: number): Point {
  const columns = Math.min(4, Math.ceil(count / 2));
  const rows = Math.ceil(count / columns);
  const width = (TRAY.width - 0.02) / columns;
  const depth = (TRAY.depth - 0.02) / rows;
  return [
    TRAY.at[0] + width * ((index % columns) + 0.5 - columns / 2),
    TRAY.floor,
    TRAY.at[2] + depth * (Math.floor(index / columns) + 0.5 - rows / 2),
  ];
}

/** Where a dropped item comes to rest inside each place it is dropped into. */
const RESTS = {
  biohazard: [CONTAINER.home[0], 0.03, CONTAINER.home[2]],
  glassBox: [GLASS_BOX.at[0], 0.01, GLASS_BOX.at[2]],
  sharps: [SHARPS.at[0], 0.02, SHARPS.at[2]],
} as const satisfies Record<string, Point>;

/** How high the opening of each place an item is dropped into stands above the bench. */
const MOUTHS = {
  biohazard: CONTAINER.depth,
  glassBox: GLASS_BOX.height,
  sharps: SHARPS.height,
} as const;

/** Where an item comes to rest at `place`: inside it, or, for a liquid, the beaker tipped with its lip at the spout. */
function restAt(place: Place): Point {
  return isPouredInto(place)
    ? originFor(POURS[place], SPOUTS[place], -POUR_TILT)
    : RESTS[place];
}

/** Where an item arrives above `place` before it drops in, or before its beaker tips. */
function entryAt(place: Place): Point {
  if (isPouredInto(place)) {
    return add(restAt(place), [0, 0.05, 0.05]);
  }
  const [x, , z] = RESTS[place];
  return [x, MOUTHS[place] + 0.08, z];
}

/** The legs of a route laid end to end on its clock, in seconds. */
function timeline(kinds: readonly Leg["kind"][], carry: number) {
  return Arr.reduce(kinds, Arr.empty<Leg>(), (legs, kind) => {
    const from = Option.match(Arr.last(legs), {
      onNone: () => 0,
      onSome: (leg) => leg.to,
    });
    const seconds = kind === "carry" ? carry : SECONDS[kind];
    return Arr.append(legs, { from, kind, to: from + seconds });
  });
}

/** The route of `item` from its slot `start` on the tray to its place. */
export function routeOf(item: Waste, start: Point): Route {
  const place = placeOf(item);
  const lifted = add(start, [0, RISE.lift, 0]);
  const entry = entryAt(place);
  const distance = Math.hypot(
    entry[0] - lifted[0],
    entry[1] - lifted[1],
    entry[2] - lifted[2]
  );
  const carry = Math.min(
    CARRY.longest,
    Math.max(CARRY.shortest, distance / CARRY.speed)
  );
  return {
    entry,
    item,
    legs: timeline(["lift", "carry", ...FINISH[place]], carry),
    lifted,
    place,
    rest: restAt(place),
    start,
  };
}

/** How long a route lasts, in seconds. */
export function durationOf(route: Route) {
  return Arr.reduce(route.legs, 0, (end, leg) => Math.max(end, leg.to));
}

/** How far through its leg of `kind` a route is at `seconds`, from 0 to 1, and 0 when the route has no such leg. */
export function shareOf(route: Route, kind: Leg["kind"], seconds: number) {
  return Option.match(
    Arr.findFirst(route.legs, (leg) => leg.kind === kind),
    {
      onNone: () => 0,
      onSome: (leg) =>
        Math.min(1, Math.max(0, (seconds - leg.from) / (leg.to - leg.from))),
    }
  );
}

/** The item after `current` on the tray, back to the first after the last, for a card that plays through the tray. */
export function nextOf(items: readonly [Waste, ...Waste[]], current: Waste) {
  return Option.getOrElse(
    Option.flatMap(
      Arr.findFirstIndex(items, (item) => item === current),
      (index) => Arr.get(items, (index + 1) % items.length)
    ),
    () => items[0]
  );
}
