import { Array as Arr, Option, Schema } from "effect";
import { unitOf } from "@/lib/island/noise";
import type { Weather } from "@/lib/island/sky";
import { Surround } from "@/lib/island/surround";
import { bendOf, shotOf } from "@/lib/island/tape";

/**
 * What the land's life sounds like (ADR 0047, D37; ADR 0050, W8): how loud
 * its birds and its night insects are at an hour of the day under a weather,
 * and which animal calls near a place. The sound module plays the
 * recordings; the day and the place decide them.
 */

/** What decides who calls at a place: what lies about it, and how much of the land there is under a roof. */
const Place = Schema.Struct({ ...Surround.fields, roof: Schema.Finite });
type Place = typeof Place.Type;

/** How loud a voice is at an hour: a soft hill over its own hours of the day, wrapping past midnight. */
function hill(hour: number, from: number, peak: number, to: number) {
  const at = ((hour % 24) + 24) % 24;
  const spread = (to - from + 24) % 24;
  const since = (at - from + 24) % 24;
  if (since > spread) {
    return 0;
  }
  const top = (peak - from + 24) % 24;
  return since <= top ? since / top : 1 - (since - top) / (spread - top);
}

/** Whether rain, a storm or snow is falling, which quiets every bird and cricket. */
function isFalling(weather: Weather) {
  return weather === "rain" || weather === "storm" || weather === "snow";
}

/**
 * How loud the birds and the crickets are, each from 0 to 1, at an hour of the
 * day (0 to 24) under a weather: a dawn chorus loudest at seven, a quieter
 * day, a second song at dusk, and crickets from dusk through the night.
 * Falling weather quiets both; a grey sky only dims the birds.
 */
export function voicesOf(hour: number, weather: Weather) {
  if (isFalling(weather)) {
    return { birds: 0, crickets: 0 };
  }
  const day = Math.max(
    hill(hour, 5, 7, 11),
    0.45 * hill(hour, 9, 13, 17),
    0.7 * hill(hour, 16, 18.5, 20)
  );
  return {
    birds: weather === "clouds" ? day * 0.6 : day,
    crickets: hill(hour, 19.5, 23, 4.5),
  };
}

/** The hours of the morning a rooster crows in, once a day, where a roof stands near. */
const DAWN = { from: 5.5, to: 6.3 } as const;

/** Whether a rooster crows at an hour of the day. */
export function crowsAt(hour: number) {
  return hour > DAWN.from && hour < DAWN.to;
}

/**
 * The recorded voices of the land (ADR 0050, W8): each animal's recording,
 * how loud it calls, whether it calls by night, and how much it belongs to a
 * place, from what lies about it and how much of it is under a roof. A
 * bulbul sings wherever there is land, a kite over open ground, an egret and
 * a duck by fresh water, a gull, a crab and now and then a dolphin by the
 * sea, a deer in the wood, a goat, a rabbit and a buffalo on the meadow, a
 * hen and a cat about the houses, and at night a frog by the water.
 */
const VOICES = [
  {
    file: "bulbul",
    fits: (place: Place) =>
      Math.max(place.forest, 0.7 * place.meadow, 0.3) * (1 - 0.6 * place.sea),
    loud: 0.4,
    night: false,
  },
  {
    file: "kite",
    fits: (place: Place) => 0.4 * (1 - place.forest) * (1 - place.sea),
    loud: 0.4,
    night: false,
  },
  {
    file: "egret",
    fits: (place: Place) => place.fresh,
    loud: 0.4,
    night: false,
  },
  {
    file: "duck",
    fits: (place: Place) => place.fresh,
    loud: 0.5,
    night: false,
  },
  { file: "gull", fits: (place: Place) => place.sea, loud: 0.4, night: false },
  {
    file: "crab",
    fits: (place: Place) => 0.5 * place.sea,
    loud: 0.5,
    night: false,
  },
  {
    file: "dolphin",
    fits: (place: Place) => (place.sea > 0.8 ? 0.3 : 0),
    loud: 0.45,
    night: false,
  },
  {
    file: "deer",
    fits: (place: Place) => 0.7 * place.forest,
    loud: 0.4,
    night: false,
  },
  {
    file: "goat",
    fits: (place: Place) => 0.6 * place.meadow,
    loud: 0.5,
    night: false,
  },
  {
    file: "rabbit",
    fits: (place: Place) => 0.6 * place.meadow,
    loud: 0.6,
    night: false,
  },
  {
    file: "buffalo",
    fits: (place: Place) => 0.4 * Math.min(place.fresh, place.meadow * 4),
    loud: 0.55,
    night: false,
  },
  { file: "hen", fits: (place: Place) => place.roof, loud: 0.5, night: false },
  {
    file: "meow",
    fits: (place: Place) => 0.6 * place.roof,
    loud: 0.5,
    night: false,
  },
  { file: "frog", fits: (place: Place) => place.fresh, loud: 0.5, night: true },
  {
    file: "meow",
    fits: (place: Place) => 0.4 * place.roof,
    loud: 0.4,
    night: true,
  },
] as const;

/** How little an animal may belong to a place and still call there. */
const FAINT = 0.15;

/**
 * One animal's call about a place (ADR 0050, W8), none where nothing that
 * calls at that time of day lives near: the seed picks among the voices that
 * belong there, each as likely as it belongs, and gives the call its own
 * pitch and side, so the same seed in the same place always calls alike. It
 * plays softly, as from a little way off.
 */
export function callOf(seed: number, place: Place, night: boolean) {
  const near = Arr.filter(
    Arr.map(VOICES, (voice) => ({ ...voice, weight: voice.fits(place) })),
    (voice) => voice.night === night && voice.weight > FAINT
  );
  const whole = Arr.reduce(near, 0, (sum, voice) => sum + voice.weight);
  const drawn = unitOf(67, seed) * whole;
  const reached = Arr.scan(near, 0, (sum, voice) => sum + voice.weight);
  return Option.map(
    Option.flatMap(
      Arr.findFirstIndex(Arr.drop(reached, 1), (sum) => drawn < sum),
      (index) => Arr.get(near, index)
    ),
    (voice) =>
      shotOf(
        voice.file,
        voice.loud * (0.25 + 0.25 * Math.min(1, voice.weight)),
        {
          pan: unitOf(67, seed, 2) * 1.2 - 0.6,
          rate: bendOf(67, seed, 110),
        }
      )
  );
}
