import { Option, Result } from "effect";
import type { GameStoreApi } from "@/components/island/store";
import type { Cast } from "@/lib/island/fishing";
import { BITE, castOf, catchOf, dipOf, reelOf } from "@/lib/island/fishing";
import type { Model } from "@/lib/island/models/kinds";

/** The float's model. */
const FLOAT: Model = { _tag: "bobber" };

/**
 * The learner's fishing rod (ADR 0047, D15): one line in the water at most, a
 * float until a fish bites, and the catch or the escape when the learner
 * reels in. The stage asks it whether a line is out, where the fox faces, and
 * what to draw.
 */
export function createRod(store: GameStoreApi) {
  let cast = Option.none<Cast>();
  let casts = 0;
  let warned = false;

  /** Reels the line in: a catch of the water it lay in inside the bite, an escape before or after it. */
  const reel = (line: Cast, now: number) => {
    const state = store.getState();
    if (reelOf(line, now) === "caught") {
      state.setNotice(null);
      state.addCatch(catchOf(state.land.seed, casts, line.water));
    } else {
      state.setNotice("escaped");
    }
    cast = Option.none();
  };

  return {
    /** Whether a line is in the water. */
    active: () => Option.isSome(cast),
    /** The float as a body on the water's face at `seconds`, nothing without a line out. */
    bodies: (seconds: number): readonly (readonly [Model, Float32Array])[] =>
      Option.match(cast, {
        onNone: () => [],
        onSome: (line) => [
          [
            FLOAT,
            new Float32Array([
              line.x,
              line.y + dipOf(line, seconds),
              line.z,
              0,
              0,
              0,
            ]),
          ] as const,
        ],
      }),
    /** Where the float bobs, which the fox faces while it fishes. */
    float: () => Option.map(cast, (line) => [line.x, line.z] as const),
    /** Casts to a place of the water at `seconds`, from where the fox stands, or reels in the line already out. */
    press: (
      place: { readonly x: number; readonly z: number },
      fox: readonly [number, number],
      seconds: number
    ) => {
      if (Option.isSome(cast)) {
        reel(cast.value, seconds);
        return;
      }
      const state = store.getState();
      Result.match(
        castOf(state.land, fox, [place.x, place.z], casts, seconds),
        {
          onFailure: state.setNotice,
          onSuccess: (line) => {
            cast = Option.some(line);
            casts += 1;
            state.did("cast");
            warned = false;
          },
        }
      );
    },
    /** Takes the line in without a word, as the fox does when it walks away. */
    stow: () => {
      cast = Option.none();
    },
    /** Warns of a bite on the line out, and lets the fish go once the bite is over. */
    tend: (seconds: number) => {
      Option.map(cast, (line) => {
        if (seconds >= line.bite && !warned) {
          warned = true;
          store.getState().setNotice("bite");
        }
        if (seconds > line.bite + BITE) {
          cast = Option.none();
          store.getState().setNotice("escaped");
        }
      });
    },
  };
}
