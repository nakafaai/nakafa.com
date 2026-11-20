import { Array as Arr, MutableHashMap, Option, Record as Rec } from "effect";
import { createBeds } from "@/components/island/beds";
import { createMusic } from "@/components/island/music";
import type { GameStoreApi } from "@/components/island/store";
import { createTape } from "@/components/island/tape";
import { bedsOf, rustles } from "@/lib/island/ambience";
import { callOf, crowsAt, voicesOf } from "@/lib/island/chorus";
import type { Cue, Heard } from "@/lib/island/cues";
import { cuesOf, shotsOf } from "@/lib/island/cues";
import { unitOf } from "@/lib/island/noise";
import { roofShareOf } from "@/lib/island/patter";
import { thundersBetween } from "@/lib/island/storm";
import { surroundOf } from "@/lib/island/surround";
import type { Recording } from "@/lib/island/tape";
import { bendOf, shotOf } from "@/lib/island/tape";
import { treadOf } from "@/lib/island/tread";
import { gustAt } from "@/lib/island/wind";

/** How loud the whole world plays, and under it the beds with the calls and the thunder, the effects, and the music. */
const LOUD = { beds: 0.7, effects: 0.85, master: 0.9, music: 0.4 } as const;

/** How far ahead the storm's thunders are laid on the audio clock, in seconds. */
const AHEAD = 2;

/** The share of seconds an animal calls in when the chorus is at its fullest: about one call in ten seconds. */
const CALLS = 0.1;

/** The least seconds between two dabs of a brush that are heard, between two rustles of the leaves, and the longest pause that still counts two cues as one run. */
const REST = { brush: 0.16, run: 2.2, rustle: 3 } as const;

/** The small effects read as soon as the sound starts, so the first footstep and the first thing set down are heard. */
const FIRST = [
  "step-grass",
  "step-sand",
  "step-stone",
  "step-wood",
  "splash",
  "thud",
  "pop",
  "dig",
  "note",
  "whoosh",
] as const satisfies Recording[];

/** What the sound hears of the game's state now. */
function heardOf(state: ReturnType<GameStoreApi["getState"]>): Heard {
  return {
    blueprints: state.blueprints.length,
    catches: state.catches.length,
    last: Option.match(Arr.last(state.pending), {
      onNone: () => "none" as const,
      onSome: (operation) => operation._tag,
    }),
    deed: state.deed.kind,
    deeds: state.deed.count,
    mode: state.mode,
    notice: state.notice,
    past: state.past.length,
    pending: state.pending.length,
    sheet: state.sheet,
    turn: state.turn,
  };
}

/**
 * The world's sound (ADR 0050, W8), every part of it a recording: the beds
 * the hour, the weather, the wind and the land about the fox mix; an animal
 * calling now and then; thunder after a storm's lightning, late by the
 * distance it crossed (ADR 0047, D33); the fox's footsteps on what it walks
 * over (D40); the cues that answer what the learner does; and two recorded
 * pieces of music. One limiter stands on the way out, so no effect clips,
 * and the game's switch silences all of it at once. It starts at the
 * learner's first press, as browsers ask, fetches each file when it is first
 * needed, and plays no bed before the world's first frame is on the screen.
 */
export function startSound(store: GameStoreApi) {
  const audio = new AudioContext({ latencyHint: "interactive" });
  const limiter = audio.createDynamicsCompressor();
  limiter.threshold.value = -3;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.2;
  limiter.connect(audio.destination);
  const master = audio.createGain();
  master.gain.value = store.getState().muted ? 0 : LOUD.master;
  master.connect(limiter);
  const bus = (loud: number) => {
    const gain = audio.createGain();
    gain.gain.value = loud;
    gain.connect(master);
    return gain;
  };
  const bedBus = bus(LOUD.beds);
  const effects = bus(LOUD.effects);
  const tape = createTape(audio);
  const beds = createBeds(audio, tape, bedBus);
  const music = createMusic(audio, bus(LOUD.music));
  Arr.forEach(FIRST, tape.ask);

  let heard = heardOf(store.getState());
  let steps = store.getState().steps;
  // The latest cue of each kind: the second it played and how many came close together before it.
  const runs = MutableHashMap.empty<Cue, { at: number; run: number }>();

  /** Plays a cue, unless it is a dab of a brush on the heels of another. */
  const cue = (name: Cue) => {
    const now = audio.currentTime;
    const before = MutableHashMap.get(runs, name);
    const since = Option.match(before, {
      onNone: () => Number.POSITIVE_INFINITY,
      onSome: (last) => now - last.at,
    });
    if (name === "brush" && since < REST.brush) {
      return;
    }
    const run = Option.match(before, {
      onNone: () => 0,
      onSome: (last) => (since < REST.run ? last.run + 1 : 0),
    });
    MutableHashMap.set(runs, name, { at: now, run });
    Arr.forEach(shotsOf(name, run), (shot) => tape.play(shot, effects));
  };

  // What lies about the fox, read again when it has walked on or the land changed.
  let about = Option.none<{
    place: readonly [number, number];
    revision: number;
    roof: number;
    surround: ReturnType<typeof surroundOf>;
  }>();
  const lookAbout = () => {
    const { land, place, revision } = store.getState();
    const fresh = Option.filter(
      about,
      (last) => last.place === place && last.revision === revision
    );
    return Option.getOrElse(fresh, () => {
      const next = {
        place,
        revision,
        roof: roofShareOf(land, place[0], place[1]),
        surround: surroundOf(land, place[0], place[1]),
      };
      about = Option.some(next);
      return next;
    });
  };

  // The storm's thunders are heard up to this second of the painter's clock, which flashes the same strikes (D33).
  let heardUntil = performance.now() / 1000;
  let second = Math.floor(heardUntil);
  let rustled = Number.NEGATIVE_INFINITY;
  let crowed = false;

  /** The calls of the second that just began: an animal near the fox, and a rooster at dawn where a roof stands near. */
  const call = (hour: number) => {
    const { roof, surround } = lookAbout();
    const voices = voicesOf(hour, store.getState().weather);
    const night = voices.crickets > voices.birds;
    const lively = night ? 0.5 * voices.crickets : voices.birds;
    if (unitOf(61, second) < lively * CALLS) {
      Option.map(callOf(second, { ...surround, roof }, night), (shot) =>
        tape.play({ ...shot, delay: unitOf(61, second, 1) * 0.8 }, bedBus)
      );
    }
    const crows = crowsAt(hour) && roof > 0.1;
    if (crows && !crowed) {
      tape.play(shotOf("rooster", 0.22), bedBus);
    }
    crowed = crows;
  };

  return {
    /** Answers what changed in the game since it was last heard: the switch, a footstep, and the cues of what the learner did. */
    hear() {
      const state = store.getState();
      const next = heardOf(state);
      master.gain.setTargetAtTime(
        state.muted ? 0 : LOUD.master,
        audio.currentTime,
        0.05
      );
      if (!state.muted) {
        Arr.forEach(cuesOf(heard, next), cue);
        if (state.steps > steps) {
          tape.play(treadOf(state.footing, state.steps), effects);
        }
      }
      heard = next;
      steps = state.steps;
    },
    /** Lets the sound sleep while the page is hidden. */
    rest() {
      music.pause();
      audio.suspend();
    },
    /** Ends the sound and lets the audio device go. */
    stop() {
      music.stop();
      audio.close();
    },
    /** Moves the mix on: the beds toward what the hour, the weather and the place ask, the thunders of the next seconds, the calls, the leaves and the music. */
    tick() {
      const state = store.getState();
      const now = performance.now() / 1000;
      const live = state.shown && !state.muted;
      const { roof, surround } = lookAbout();
      const hour = state.minute / 60;
      const gust = gustAt(state.place[0], state.place[1], now);
      const levels = bedsOf({
        gust,
        hour,
        roof,
        surround,
        weather: state.weather,
      });
      beds.mix(live ? levels : Rec.map(levels, () => 0));
      const until = now + AHEAD;
      if (live && state.weather === "storm") {
        Arr.forEach(thundersBetween(heardUntil, until), (roll) =>
          tape.play(
            shotOf("thunder", roll.loud, { rate: roll.rate }),
            bedBus,
            audio.currentTime + Math.max(0, roll.at - now)
          )
        );
      }
      heardUntil = until;
      if (!live) {
        music.pause();
        return;
      }
      music.play();
      if (Math.floor(now) !== second) {
        second = Math.floor(now);
        call(hour);
      }
      if (
        now - rustled > REST.rustle &&
        rustles(gust, state.weather, surround.forest)
      ) {
        rustled = now;
        tape.play(
          shotOf("leaves", 0.3 * surround.forest, {
            rate: 1.15 * bendOf(59, second, 200),
          }),
          bedBus
        );
      }
    },
    /** Wakes the audio device, which a browser may hold asleep until a press and puts to sleep with a hidden page. */
    wake() {
      audio.resume();
    },
  };
}
