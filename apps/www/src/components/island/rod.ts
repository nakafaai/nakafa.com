import { idOf } from "@repo/backend/confect/island/blocks";
import { Option, Result } from "effect";
import type { GameStoreApi } from "@/components/island/store";
import { SLOTS } from "@/lib/island/atlas";
import {
  BITE,
  type Cast,
  castOf,
  catchOf,
  dipOf,
  reelOf,
} from "@/lib/island/fishing";
import type { castRay } from "@/lib/island/ray";
import { standingQuad } from "@/lib/island/wild";

/** The water block, where a line is cast. */
const WATER_BLOCK = idOf("water");

/**
 * The learner's fishing rod (ADR 0047, D15): one line in the water at most, a
 * float until a fish bites, and the catch or the escape when the learner
 * reels in. The stage asks it whether frames must keep coming, where the fox
 * faces, and what to draw.
 */
export function createRod(store: GameStoreApi) {
  let cast = Option.none<Cast>();
  let casts = 0;
  let warned = false;

  /** Reels the line in: a catch inside the bite, an escape before or after it. */
  const reel = (line: Cast, now: number) => {
    const state = store.getState();
    if (reelOf(line, now) === "caught") {
      state.setNotice(null);
      state.addCatch(catchOf(state.seed, casts));
    } else {
      state.setNotice("escaped");
    }
    cast = Option.none();
  };

  return {
    /** Whether a line is in the water, which keeps the frames coming. */
    active: () => Option.isSome(cast),
    /** Where the float bobs, which the fox faces while it fishes. */
    float: () => Option.map(cast, (line) => [line.x, line.z] as const),
    /** Casts into the water a press hit, from where the fox stands, or reels in the line already out. */
    press: (
      hit: ReturnType<typeof castRay>,
      fox: readonly [number, number]
    ) => {
      const now = performance.now() / 1000;
      if (Option.isSome(cast)) {
        reel(cast.value, now);
        return;
      }
      const state = store.getState();
      Option.map(hit, (found) => {
        if (found.block !== WATER_BLOCK) {
          state.setNotice("far");
          return;
        }
        Result.match(castOf(fox, found.hit, state.seed, casts, now), {
          onFailure: () => state.setNotice("far"),
          onSuccess: (line) => {
            cast = Option.some(line);
            casts += 1;
            warned = false;
          },
        });
      });
    },
    /** The float as a quad standing in the water this moment, nothing without a line out. */
    quads: (seconds: number, yaw: number) =>
      Option.match(cast, {
        onNone: () => [],
        onSome: (line) =>
          standingQuad(
            SLOTS.bobber,
            [line.x, line.y - 0.3 + dipOf(line, seconds), line.z],
            0.5,
            yaw
          ),
      }),
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
