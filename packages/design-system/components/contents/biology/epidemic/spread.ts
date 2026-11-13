import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { Array as Arr, Order, Schema } from "effect";

/**
 * The measures a town can take, each as the share of people who take it, from
 * 0 to 1: wearing masks, washing hands, being vaccinated, and staying home.
 */
export const MeasuresSchema = Schema.Struct({
  distancing: Schema.Finite,
  masks: Schema.Finite,
  vaccinated: Schema.Finite,
  washing: Schema.Finite,
});
export type Measures = typeof MeasuresSchema.Type;

/** How the virus passes: through the air people breathe, or by touch. */
export const RouteSchema = Schema.Literals(["air", "touch"]);
export type Route = typeof RouteSchema.Type;

/** The assumptions of the card's model, each a plain round value for teaching. */
export const SPREAD = {
  /** People an infected person infects in a town that takes no measure. */
  basic: 3,
  /** Days a person stays infectious. */
  days: 7,
  /** The share of a contact's risk one mask removes, for its wearer either way. */
  mask: 0.5,
  /** The share of infections a vaccine prevents. */
  vaccine: 0.8,
  /** The share of touch-borne risk that washing hands removes. */
  washing: 0.5,
} as const;

/**
 * How much the measures cut each contact's risk. A mask works on the air
 * route at both ends of a contact, so masks enter twice; washing hands works
 * on the touch route; people who stay home make no contacts at all.
 */
export function contactFactor(measures: Measures, route: Route) {
  const stayOut = 1 - clamp(measures.distancing);
  if (route === "air") {
    const masked = 1 - clamp(measures.masks) * SPREAD.mask;
    return stayOut * masked * masked;
  }
  return stayOut * (1 - clamp(measures.washing) * SPREAD.washing);
}

/** The share of the town a vaccine has made immune before the outbreak starts. */
export function immuneShare(measures: Measures) {
  return clamp(measures.vaccinated) * SPREAD.vaccine;
}

/**
 * The effective reproduction number at the start: how many people one
 * infected person infects on average once the measures and the vaccinated
 * share are counted. Below 1 an outbreak dies out.
 */
export function reproductionOf(measures: Measures, route: Route) {
  return (
    SPREAD.basic * contactFactor(measures, route) * (1 - immuneShare(measures))
  );
}

/** The shares of the town that are susceptible, infected and recovered on one day. */
export const DaySchema = Schema.Struct({
  day: Schema.Finite,
  infected: Schema.Finite,
  recovered: Schema.Finite,
  susceptible: Schema.Finite,
});
export type Day = typeof DaySchema.Type;

/**
 * The outbreak day by day, from one person in a hundred infected, through
 * the SIR model of Kermack and McKendrick (1927) integrated with a fourth
 * order Runge-Kutta step of a tenth of a day. The vaccinated immune share
 * starts among the recovered.
 */
export function outbreakOf(measures: Measures, route: Route, days: number) {
  const gamma = 1 / SPREAD.days;
  const beta = SPREAD.basic * gamma * contactFactor(measures, route);
  const seed = 0.01;
  const immune = immuneShare(measures) * (1 - seed);
  const step = 0.1;
  const slope = (s: number, i: number) =>
    [-beta * s * i, beta * s * i - gamma * i] as const;

  return Arr.scan(
    Arr.range(1, Math.max(1, Math.round(days))),
    {
      day: 0,
      infected: seed,
      recovered: immune,
      susceptible: 1 - seed - immune,
    },
    (state, day) => {
      let s = state.susceptible;
      let i = state.infected;
      for (let tick = 0; tick < 1 / step; tick += 1) {
        const [ds1, di1] = slope(s, i);
        const [ds2, di2] = slope(s + (ds1 * step) / 2, i + (di1 * step) / 2);
        const [ds3, di3] = slope(s + (ds2 * step) / 2, i + (di2 * step) / 2);
        const [ds4, di4] = slope(s + ds3 * step, i + di3 * step);
        s += ((ds1 + 2 * ds2 + 2 * ds3 + ds4) * step) / 6;
        i += ((di1 + 2 * di2 + 2 * di3 + di4) * step) / 6;
      }
      return { day, infected: i, recovered: 1 - s - i, susceptible: s };
    }
  );
}

/** The largest infected share on any day of an outbreak. */
export function peakOf(outbreak: readonly Day[]) {
  return Arr.reduce(outbreak, 0, (peak, day) => Math.max(peak, day.infected));
}

/** One person crossing the square, in metres from its middle. */
export const WalkerSchema = Schema.Struct({
  heading: Schema.Finite,
  home: Schema.Boolean,
  x: Schema.Finite,
  y: Schema.Finite,
});
export type Walker = typeof WalkerSchema.Type;

/** The square is 60 m by 40 m, and people stroll at 1.2 m/s. */
export const SQUARE = { depth: 40, speed: 1.2, width: 60 } as const;

/** A crowd of `count` people placed at seeded spots, the first `home` share at home. */
export function crowdOf(count: number, home: number) {
  return Arr.map(Arr.range(0, count - 1), (index) => ({
    heading: hashUnit(index, 3) * Math.PI * 2,
    home: index < Math.round(count * clamp(home)),
    x: (hashUnit(index, 1) - 0.5) * SQUARE.width,
    y: (hashUnit(index, 2) - 0.5) * SQUARE.depth,
  }));
}

/**
 * Moves a walker `seconds` along its heading, turning a little at random each
 * step and bouncing off the square's edges. People at home stay put.
 */
export function walk(walker: Walker, seconds: number, salt: number): Walker {
  if (walker.home) {
    return walker;
  }
  const turn = (hashUnit(salt, walker.x * 7 + walker.y) - 0.5) * 0.6;
  const heading = walker.heading + turn;
  const x = walker.x + Math.cos(heading) * SQUARE.speed * seconds;
  const y = walker.y + Math.sin(heading) * SQUARE.speed * seconds;
  const halfWidth = SQUARE.width / 2;
  const halfDepth = SQUARE.depth / 2;
  const bounceX = Math.abs(x) > halfWidth;
  const bounceY = Math.abs(y) > halfDepth;
  return {
    heading: Math.atan2(
      bounceY ? -Math.sin(heading) : Math.sin(heading),
      bounceX ? -Math.cos(heading) : Math.cos(heading)
    ),
    home: false,
    x: Math.max(-halfWidth, Math.min(halfWidth, x)),
    y: Math.max(-halfDepth, Math.min(halfDepth, y)),
  };
}

/**
 * The indexes of the `count` susceptible walkers out in the square who stand
 * closest to someone infected: an outbreak spreads to the people nearby.
 */
export function nextInfected(
  walkers: readonly Walker[],
  infected: readonly boolean[],
  susceptible: readonly boolean[],
  count: number
) {
  const sources = Arr.filter(
    walkers,
    (walker, index) => infected[index] === true && !walker.home
  );
  if (sources.length === 0 || count <= 0) {
    return [];
  }
  const nearest = (walker: Walker) =>
    Arr.reduce(sources, Number.POSITIVE_INFINITY, (best, source) =>
      Math.min(best, Math.hypot(source.x - walker.x, source.y - walker.y))
    );
  const candidates = Arr.filter(
    Arr.map(walkers, (walker, index) => ({ distance: nearest(walker), index })),
    ({ index }) => susceptible[index] === true && walkers[index]?.home === false
  );
  return Arr.map(
    Arr.take(
      Arr.sortWith(candidates, (candidate) => candidate.distance, Order.Number),
      count
    ),
    ({ index }) => index
  );
}

/** A share kept between 0 and 1. */
function clamp(share: number) {
  return Math.min(1, Math.max(0, share));
}
