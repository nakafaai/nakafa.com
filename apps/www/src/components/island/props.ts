import { Array as Arr, Option } from "effect";
import type { GameStoreApi } from "@/components/island/store";
import { CHUNK } from "@/lib/island/land/chunk";
import type { Loose } from "@/lib/island/loose";
import { bumped, LooseKind, stepLoose, tapped } from "@/lib/island/loose";
import type { Model } from "@/lib/island/models/kinds";
import {
  bodyOf,
  dropOf,
  gathered,
  touchedAt,
  withBalls,
} from "@/lib/island/props";
import { BODY } from "@/lib/island/walker";

/** The longest moment loose things are moved by in one go, in seconds, so a frame that came late never drops one through the ground. */
const MOMENT = 0.1;

/** The model a loose thing of a kind is drawn with: the ball as the thing it is, a fruit as its own. */
function modelOf(kind: LooseKind): Model {
  return kind === "ball"
    ? { _tag: "thing", kind: "ball", look: 0 }
    : { _tag: "fruit", kind };
}

/**
 * The loose things of the land about the fox (ADR 0050, W2): every ball the
 * learner set down there, which the fox kicks when it runs into one or the
 * learner taps one within its reach, and the fruit a shaken tree drops. Each
 * falls, bounces, rolls, floats and comes to rest by its own weight.
 */
export function createProps(store: GameStoreApi) {
  let loose: readonly Loose[] = [];
  let shakes = 0;
  let seen = { cx: Number.NaN, cz: Number.NaN, revision: -1 };
  let fox = Option.none<{
    readonly x: number;
    readonly y: number;
    readonly z: number;
  }>();

  /** Kicks one loose thing away from a place when it lies within reach of it. Whether it was kicked. */
  const kickFrom = (index: number, from: readonly [number, number]) =>
    Option.match(
      Option.flatMap(Arr.get(loose, index), (item) => tapped(item, from)),
      {
        onNone: () => false,
        onSome: (kicked) => {
          loose = Arr.map(loose, (item, at) => (at === index ? kicked : item));
          return true;
        },
      }
    );

  return {
    /**
     * Moves every loose thing on by `seconds`, the fox at `at` kicking the
     * ones it runs into. The balls follow the land: a new one appears where
     * it was set down, and a change to the land wakes whatever lay still.
     */
    advance(
      seconds: number,
      at: { readonly x: number; readonly y: number; readonly z: number }
    ) {
      const state = store.getState();
      const moment = Math.min(seconds, MOMENT);
      const [cx, cz] = [Math.floor(at.x / CHUNK), Math.floor(at.z / CHUNK)];
      if (
        cx !== seen.cx ||
        cz !== seen.cz ||
        state.revision !== seen.revision
      ) {
        const woken = state.revision !== seen.revision;
        loose = Arr.map(withBalls(state.land, loose, cx, cz), (item) =>
          woken ? { ...item, still: 0 } : item
        );
        seen = { cx, cz, revision: state.revision };
      }
      const before = Option.getOrElse(fox, () => at);
      const kicker = {
        ...at,
        speedX: moment > 0 ? (at.x - before.x) / moment : 0,
        speedZ: moment > 0 ? (at.z - before.z) / moment : 0,
      };
      fox = Option.some(at);
      loose = Arr.map(loose, (item) =>
        stepLoose(
          state.land,
          Option.getOrElse(bumped(item, kicker, BODY), () => item),
          moment
        )
      );
    },
    /** What the painter draws for the loose things: each kind's model once, with the bodies of every one of that kind. */
    bodies(): readonly (readonly [Model, Float32Array])[] {
      return Arr.filter(
        Arr.map(
          LooseKind.literals,
          (kind) =>
            [
              modelOf(kind),
              Float32Array.from(
                Arr.flatMap(
                  Arr.filter(loose, (item) => item.kind === kind),
                  bodyOf
                )
              ),
            ] as const
        ),
        ([, places]) => places.length > 0
      );
    },
    /** Kicks the loose thing at a place in the list away from the fox, when the fox stands within reach of it. Whether it was kicked. */
    kick: (index: number) =>
      Option.match(fox, {
        onNone: () => false,
        onSome: (at) => kickFrom(index, [at.x, at.z]),
      }),
    /** Every loose thing, for the hand that picks one out. */
    loose: () => loose,
    /** Shakes a tree of a kind whose foot is at a place: its fruit drops, where it bears any. Whether any dropped. */
    shake(x: number, y: number, z: number, kind: string) {
      const dropped = dropOf(store.getState().land.seed, shakes, kind, [
        x,
        y,
        z,
      ]);
      loose = gathered(loose, dropped);
      shakes += 1;
      return dropped.length > 0;
    },
    /** A press at a place of the land: the loose thing it touches is kicked away from the fox at `at`, when the fox stands within reach of it. Whether one was kicked. */
    touch: (
      x: number,
      z: number,
      at: { readonly x: number; readonly z: number }
    ) =>
      Option.match(touchedAt(loose, x, z), {
        onNone: () => false,
        onSome: (index) => kickFrom(index, [at.x, at.z]),
      }),
  };
}
