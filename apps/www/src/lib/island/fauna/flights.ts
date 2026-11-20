import { Array as Arr, Match, Option, Schema } from "effect";
import type { Dice } from "@/lib/island/fauna/cast";
import { castOf } from "@/lib/island/fauna/cast";
import type { Survey } from "@/lib/island/fauna/habitat";
import type { Land } from "@/lib/island/land/ground";
import { heightAt } from "@/lib/island/land/ground";
import type { Model } from "@/lib/island/models/kinds";
import { unitOf } from "@/lib/island/noise";

/** A place in the world: across, up, deep. */
const Place = Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]);

/**
 * One creature of the air over a cell of the land (ADR 0047, D11 and D49;
 * ADR 0050, W9): a bird of the sky on a loop `radius` blocks about a place at
 * the height `height`, with the perch it comes down to; or a visitor of the
 * flowers hovering in a small loop over a meadow. `phase` is where on its
 * loop it begins, in radians.
 */
const Flight = Schema.Union([
  Schema.TaggedStruct("sky", {
    height: Schema.Finite,
    index: Schema.Int,
    perch: Place,
    phase: Schema.Finite,
    radius: Schema.Finite,
    x: Schema.Finite,
    z: Schema.Finite,
  }),
  Schema.TaggedStruct("bloom", {
    height: Schema.Finite,
    index: Schema.Int,
    phase: Schema.Finite,
    radius: Schema.Finite,
    x: Schema.Finite,
    z: Schema.Finite,
  }),
]);
type Flight = typeof Flight.Type;

/**
 * A bird of the sky's round of the day (ADR 0047, D49), in seconds: it flies
 * its loop, glides down onto its perch (a crown, or the ground where no tree
 * stands), sits a while, and rises back onto its loop where it left it.
 */
const ROUND = { cycle: 36, fly: 26, land: 3, sit: 5 } as const;

/** How fast each creature of the air flies its loop, in blocks a second. */
const SPEED = { bloom: 0.9, sky: 2.4 } as const;

/** How many places of land a cell must offer before birds circle over it, and how many of meadow before the flowers have visitors. */
const NEED = { bloom: 3, sky: 12 } as const;

/** A smooth step from 0 to 1, for a bird gliding down or rising. */
function eased(share: number) {
  return share * share * (3 - 2 * share);
}

/** The way a creature on a loop faces, as a body's yaw, from the heading of its loop. */
function yawOf(heading: number) {
  return Math.atan2(Math.cos(heading), Math.sin(heading));
}

/** Where a creature is on its loop after `flown` seconds of flying, and the way it heads. */
function loopOf(flight: Flight, flown: number) {
  const angle = flight.phase + (flown * SPEED[flight._tag]) / flight.radius;
  return {
    heading: angle + Math.PI / 2,
    x: flight.x + Math.cos(angle) * flight.radius,
    y: flight.height + Math.sin(flown * 3 + flight.phase) * 0.3,
    z: flight.z + Math.sin(angle) * flight.radius,
  };
}

/**
 * Where a bird of the sky is at `time` and whether it is on the wing (D49):
 * on its loop while it flies, gliding down to its perch and back up again,
 * still on its perch while it sits. Its loop counts only the time it has
 * flown, so it rises back onto the loop where it came down from it.
 */
export function skyAt(flight: Extract<Flight, { _tag: "sky" }>, time: number) {
  const shifted = time + flight.phase * 7;
  const cycle = Math.floor(shifted / ROUND.cycle);
  const within = shifted - cycle * ROUND.cycle;
  const loop = loopOf(
    flight,
    cycle * ROUND.fly + Math.min(within, ROUND.fly) - flight.phase * 7
  );
  if (within < ROUND.fly) {
    return { ...loop, flying: true };
  }
  const down = (within - ROUND.fly) / ROUND.land;
  const up =
    (within - ROUND.fly - ROUND.land - ROUND.sit) /
    (ROUND.cycle - ROUND.fly - ROUND.land - ROUND.sit);
  const sitting = down >= 1 && up < 0;
  const share = sitting ? 1 : eased(down < 1 ? down : 1 - up);
  return {
    flying: !sitting,
    heading: loop.heading,
    x: loop.x + (flight.perch[0] - loop.x) * share,
    y: loop.y + (flight.perch[1] - loop.y) * share,
    z: loop.z + (flight.perch[2] - loop.z) * share,
  };
}

/**
 * The creatures of a cell's air at `time` as drawn bodies (ADR 0047, D25 and
 * D49), each with its model: a bird of the sky on the wing while it flies and
 * folded while it perches, a visitor of the flowers on its loop.
 */
export function flightBodies(flights: readonly Flight[], time: number) {
  return Arr.map(flights, (flight) =>
    Match.valueTags(flight, {
      bloom: (bloom) => {
        const at = loopOf(bloom, time);
        const model: Model = { _tag: "species", index: bloom.index };
        return [
          model,
          Float32Array.of(at.x, at.y, at.z, yawOf(at.heading), 0, 0),
        ] as const;
      },
      sky: (sky) => {
        const at = skyAt(sky, time);
        const model: Model = at.flying
          ? { _tag: "flyer", index: sky.index }
          : { _tag: "species", index: sky.index };
        return [
          model,
          Float32Array.of(at.x, at.y, at.z, yawOf(at.heading), 0, 0),
        ] as const;
      },
    })
  );
}

/**
 * The creatures of the air one cell of the land holds on a day (ADR 0050,
 * W9): two birds over a cell with land enough, perchers and raptors where it
 * is mostly forest or highland, each with a crown of the cell to come down
 * to, or the ground where no tree stands; and three visitors over its
 * meadow's flowers.
 */
export function flightsOf(
  land: Land,
  survey: Survey,
  dice: Dice,
  crowns: readonly (typeof Place.Type)[]
): readonly Flight[] {
  const wooded = [...survey.forest, ...survey.highland];
  const dry = [...survey.meadow, ...survey.grass, ...survey.shore, ...wooded];
  const roll = (slot: number, channel: number) =>
    unitOf(dice.seed + 701 + channel, dice.gx, slot + dice.day * 3, dice.gz);
  const birds = Arr.map(
    dry.length >= NEED.sky ? [0, 1] : [],
    (slot): Option.Option<Flight> => {
      const spot = dry[Math.floor(roll(slot, 0) * dry.length)];
      const ground = heightAt(land, spot.x, spot.z);
      return Option.map(
        castOf(
          wooded.length * 2 > dry.length ? "perchers" : "sky",
          dice,
          dice.day + slot
        ),
        (index) => ({
          _tag: "sky",
          height: ground + 10 + roll(slot, 1) * 4,
          index,
          perch: Option.getOrElse(
            Arr.get(crowns, Math.floor(roll(slot, 2) * crowns.length)),
            () => [spot.x, ground, spot.z] as const
          ),
          phase: roll(slot, 3) * Math.PI * 2,
          radius: 8 + roll(slot, 4) * 10,
          x: spot.x,
          z: spot.z,
        })
      );
    }
  );
  const visitors = Arr.map(
    survey.meadow.length >= NEED.bloom ? [0, 1, 2] : [],
    (slot): Option.Option<Flight> => {
      const spot = survey.meadow[slot];
      return Option.map(castOf("bloom", dice, dice.day + slot), (index) => ({
        _tag: "bloom",
        height: heightAt(land, spot.x, spot.z) + 0.8 + roll(slot, 5),
        index,
        phase: roll(slot, 6) * Math.PI * 2,
        radius: 1.2 + roll(slot, 7) * 1.6,
        x: spot.x,
        z: spot.z,
      }));
    }
  );
  return Arr.getSomes([...birds, ...visitors]);
}
