import type { Thing } from "@repo/backend/confect/island/things";
import { Array as Arr, Option, Schema } from "effect";
import { FOOTPRINTS } from "@/lib/island/blockers";
import type { Dice } from "@/lib/island/fauna/cast";
import type { Survey } from "@/lib/island/fauna/habitat";
import { cellKey } from "@/lib/island/fauna/habitat";
import type { Root } from "@/lib/island/flora/rooted";
import type { Land } from "@/lib/island/land/ground";
import { standAt } from "@/lib/island/land/ground";
import type { Animal } from "@/lib/island/life";
import { Dweller, FOLK, paceOf, wander } from "@/lib/island/life";
import type { Model } from "@/lib/island/models/kinds";
import { hashOf } from "@/lib/island/noise";
import { suitsOf } from "@/lib/island/room";

/** A place on the land: across and deep. */
const Spot = Schema.Tuple([Schema.Finite, Schema.Finite]);

/**
 * One villager and the places of its day (ADR 0047, D54; ADR 0050, W9): its
 * body, which of the folk it is, its home and whether that is indoors, where
 * it gathers, where it works, and, for the one who fishes, the water it
 * looks out on from its bank.
 */
export const Villager = Schema.Struct({
  body: Dweller,
  fishes: Schema.Boolean,
  home: Spot,
  index: Schema.Int,
  indoors: Schema.Boolean,
  plaza: Spot,
  water: Spot,
  work: Spot,
});
export type Villager = typeof Villager.Type;

/**
 * The hours of a villager's day (ADR 0047, D54): it wakes and leaves home,
 * goes to work, comes back to gather for the evening, and goes home to
 * sleep. Each villager keeps the hours a little apart from the others, by
 * `stagger` hours each, so they never move as one.
 */
const DAY = { home: 22, rest: 17, stagger: 0.4, wake: 6, work: 9 } as const;

/** How near its spot, in blocks, a villager counts as there, and how far it walks toward it before it looks again. */
const WALK = { hop: 5, near: 1 } as const;

/** How far in front of a cottage's middle its doorstep lies, in blocks. */
const DOORSTEP = FOOTPRINTS.cottage.deep + 0.9;

/** The things a villager lives in, gathers at and visits (ADR 0050, W9). */
const PLACES = {
  gathers: ["saung", "library", "well", "campfire"],
  homes: ["cottage"],
  visits: ["bench", "boat", "campfire", "well"],
} as const satisfies Record<string, readonly Thing[]>;

/** One thing or plant that stands in a cell. */
type Standing = Root["standing"][number];

/** The part of the day it is for villager `index` at `hour`: at home, gathered, or at work. */
function partOf(index: number, hour: number) {
  const shifted = (hour - index * DAY.stagger + 24) % 24;
  if (shifted < DAY.wake || shifted >= DAY.home) {
    return "home";
  }
  return shifted >= DAY.work && shifted < DAY.rest ? "work" : "plaza";
}

/** A place to stand beside a thing, each villager at a side of its own. */
function beside(thing: Standing, slot: number) {
  const out = thing.radius + 0.9;
  return [
    thing.x + Math.cos(slot * 2.1) * out,
    thing.z + Math.sin(slot * 2.1) * out,
  ] as const;
}

/**
 * Where a villager fishes from (D54): the dry bank nearest the water closest
 * to its home, found by walking back from that water toward the home, with
 * the water it looks out on. None where the cell has no water, or no bank
 * within a walk of it.
 */
function bankOf(land: Land, survey: Survey, home: readonly [number, number]) {
  const away = (spot: { readonly x: number; readonly z: number }) =>
    Math.hypot(spot.x - home[0], spot.z - home[1]);
  return Option.flatMap(
    Arr.match([...survey.fresh, ...survey.shallows, ...survey.sea], {
      onEmpty: () => Option.none(),
      onNonEmpty: (waters) =>
        Option.some(
          Arr.reduce(waters, Arr.headNonEmpty(waters), (best, spot) =>
            away(spot) < away(best) ? spot : best
          )
        ),
    }),
    (water) => {
      const reach = Math.max(1e-6, away(water));
      const at = (step: number) =>
        [
          water.x + ((home[0] - water.x) / reach) * step * 0.5,
          water.z + ((home[1] - water.z) / reach) * step * 0.5,
        ] as const;
      return Option.map(
        Arr.findFirst(Arr.range(1, 80), (step) =>
          suitsOf(land, "dry", at(step)[0], at(step)[1])
        ),
        (step) => ({ dry: at(step), water: [water.x, water.z] as const })
      );
    }
  );
}

/**
 * The villagers of one cell of the land (ADR 0047, D54; ADR 0050, W9): one
 * for each of its first three cottages, at home on its doorstep, gathering at
 * a saung, a library, a well or a fire and visiting a bench, a boat, a fire
 * or a well of the cell; or, where nothing is built and the world opens
 * there, two who camp at `camp`. The first of them fishes by day from the
 * bank nearest home. A villager who was there before (`held`) keeps where it
 * stands.
 */
export function villagersOf(
  land: Land,
  standing: readonly Standing[],
  survey: Survey,
  dice: Dice,
  lives: {
    readonly camp: Option.Option<readonly [number, number]>;
    readonly held: readonly Villager[];
  }
): readonly Villager[] {
  const of = (kinds: readonly Thing[]) =>
    Arr.filter(
      standing,
      (thing) =>
        thing.origin._tag === "thing" && Arr.contains(kinds, thing.origin.kind)
    );
  const cottages = Arr.take(of(PLACES.homes), FOLK.length);
  const gathers = of(PLACES.gathers);
  const visits = of(PLACES.visits);
  const doors = Arr.map(
    cottages,
    (home) =>
      [
        home.x + Math.sin(home.yaw) * DOORSTEP,
        home.z + Math.cos(home.yaw) * DOORSTEP,
      ] as const
  );
  const camps = Option.match(lives.camp, {
    onNone: () => [],
    onSome: ([x, z]) => [
      [x + 1.6, z + 0.5] as const,
      [x - 1.4, z + 1.1] as const,
    ],
  });
  const homes = doors.length > 0 ? doors : camps;
  const bank = Option.flatMap(Arr.head(homes), (home) =>
    bankOf(land, survey, home)
  );
  return Arr.map(homes, (home, index): Villager => {
    const plaza = Option.match(
      Arr.get(gathers, index % (gathers.length || 1)),
      {
        onNone: () => home,
        onSome: (thing) => beside(thing, index),
      }
    );
    const visit = Option.match(
      Arr.get(visits, (index + 1) % (visits.length || 1)),
      { onNone: () => plaza, onSome: (thing) => beside(thing, index + 3) }
    );
    const fisher = index === 0 ? bank : Option.none();
    return {
      body: Option.match(Arr.get(lives.held, index), {
        onNone: () => ({
          cell: cellKey(dice.gx, dice.gz),
          ground: "dry",
          hx: home[0],
          hz: home[1],
          kind: FOLK[index],
          pack: 100 + index,
          pet: 0,
          rest: 0,
          seed: hashOf(dice.seed + 70, dice.gx, index, dice.gz),
          steps: 0,
          tx: home[0],
          tz: home[1],
          x: home[0],
          z: home[1],
        }),
        onSome: (villager) => villager.body,
      }),
      fishes: Option.isSome(fisher),
      home,
      index,
      indoors: doors.length > 0,
      plaza,
      water: Option.match(fisher, {
        onNone: () => home,
        onSome: (found) => found.water,
      }),
      work: Option.match(fisher, {
        onNone: () => visit,
        onSome: (found) => found.dry,
      }),
    };
  });
}

/** Where a villager is bound at `hour`, and how far from it it stands. */
function boundOf(villager: Villager, hour: number) {
  const part = partOf(villager.index, hour);
  const spot = villager[part];
  return {
    away: Math.hypot(spot[0] - villager.body.x, spot[1] - villager.body.z),
    part,
    spot,
  };
}

/** Whether a villager is asleep in its cottage at `hour`: bound home and at its doorstep, so it is inside and not drawn. */
export function isAsleep(villager: Villager, hour: number) {
  const bound = boundOf(villager, hour);
  return villager.indoors && bound.part === "home" && bound.away <= WALK.near;
}

/** Whether a villager stands fishing at `hour`: the one who fishes, at work and on its bank. */
function isFishing(villager: Villager, hour: number) {
  const bound = boundOf(villager, hour);
  return villager.fishes && bound.part === "work" && bound.away <= WALK.near;
}

/**
 * A villager after `dt` seconds of its day at `hour` (D54): it walks toward
 * the spot its hour binds it to, a few blocks at a time and without
 * dawdling, giving way as any creature does (D22); there it lingers, or,
 * fishing, stands on its bank and looks out on the water.
 */
export function keepDay(
  land: Land,
  villager: Villager,
  step: {
    readonly blocked: (x: number, z: number, half: number) => boolean;
    readonly dt: number;
    readonly hour: number;
    readonly others: readonly Animal[];
  }
): Villager {
  const { body } = villager;
  const bound = boundOf(villager, step.hour);
  if (isFishing(villager, step.hour)) {
    const [dx, dz] = [villager.water[0] - body.x, villager.water[1] - body.z];
    const reach = Math.max(1e-6, Math.hypot(dx, dz));
    return {
      ...villager,
      body: {
        ...body,
        rest: 0.5,
        tx: body.x + (dx / reach) * 0.06,
        tz: body.z + (dz / reach) * 0.06,
      },
    };
  }
  const far = bound.away > WALK.near;
  const hop = Math.min(1, WALK.hop / Math.max(1e-6, bound.away));
  const next = wander(land, body, {
    blocked: step.blocked,
    dt: step.dt,
    home: [
      body.x + (bound.spot[0] - body.x) * hop,
      body.z + (bound.spot[1] - body.z) * hop,
    ],
    others: step.others,
    pace: paceOf(body.kind),
    spread: far ? 1.2 : 0.8,
  });
  // On its way it sets off again at once; a step that was blocked keeps its short pause.
  const striding = far && next.steps !== body.steps && next.rest > 0.6;
  return { ...villager, body: striding ? { ...next, rest: 0 } : next };
}

/**
 * The rods of the villagers who fish at `hour` as drawn bodies (D54), one
 * model with a body for each, held out toward the water it looks on.
 */
export function tackleBodies(
  land: Land,
  villagers: readonly Villager[],
  hour: number
) {
  const fishing = Arr.filter(villagers, (villager) =>
    isFishing(villager, hour)
  );
  const model: Model = { _tag: "tackle" };
  return Arr.map(
    Arr.match(fishing, { onEmpty: () => [], onNonEmpty: (found) => [found] }),
    (found) =>
      [
        model,
        Float32Array.from(
          Arr.flatMap(found, ({ body, water }) => [
            body.x,
            standAt(land, body.x, body.z),
            body.z,
            Math.atan2(water[0] - body.x, water[1] - body.z),
            0,
            0,
          ])
        ),
      ] as const
  );
}
