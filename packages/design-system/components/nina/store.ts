import type { Look } from "@repo/design-system/components/nina/face";
import type { Options } from "@repo/design-system/components/nina/figure";
import {
  type Live,
  LiveSchema,
  press,
  retarget,
  start,
  step,
} from "@repo/design-system/components/nina/live";
import { Schema } from "effect";
import { createStore } from "zustand";
import { combine } from "zustand/middleware";

/** Her life, once it has begun. Before that she is the still picture. */
const LifeSchema = Schema.Struct({ live: Schema.UndefinedOr(LiveSchema) });

const BEFORE: typeof LifeSchema.Type = { live: undefined };

/**
 * Creates the store of one Nina. The clock, the pointer and her presses write
 * it, so the one figure that reads it draws again with each frame, and nothing
 * else does. `draw` gives numbers from 0 up to 1 for her habits.
 */
export function createLifeStore(draw: () => number) {
  return createStore(
    combine(BEFORE, (set, get) => ({
      /** Begins her life, on the moment that her still picture shows. */
      begin: (options: Options) => {
        set({ live: start(options, draw) });
      },
      /** Lets a frame go by, with the pointer at `pointer`. */
      tick: (options: Options, dt: number, pointer: Look) => {
        const { live } = get();
        if (live) {
          set({ live: step(live, options, dt, pointer, draw) });
        }
      },
      /** Answers a press. Gives whether she ducks behind the edge. */
      press: (options: Options) => {
        const { live } = get();
        if (!live) {
          return false;
        }
        const reaction = press(live, options);
        set({ live: reaction.live });
        return reaction.duck;
      },
      /** Changes what she does from now on. */
      retarget: (act: Live["act"]) => {
        const { live } = get();
        if (live) {
          set({ live: retarget(live, act) });
        }
      },
    }))
  );
}
