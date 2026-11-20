import { regionOf } from "@repo/backend/confect/island/chunk";
import { Array as Arr, MutableHashMap, Option, Order } from "effect";
import type { Painter } from "@/components/island/draw";
import type { Ring } from "@/components/island/terrain";
import type { Orbit } from "@/lib/island/camera";
import { CHUNK, keyOf } from "@/lib/island/land/chunk";
import type { Land } from "@/lib/island/land/ground";
import { chunkAt, forgetBeyond } from "@/lib/island/land/ground";
import {
  fillHorizon,
  fillWindow,
  horizonOf,
  originOf,
  WINDOW,
  windowOf,
} from "@/lib/island/land/window";
import type { Animal } from "@/lib/island/life";
import type { Model } from "@/lib/island/models/kinds";
import { modelKey } from "@/lib/island/models/kinds";
import { livedOf, sceneBodies, sceneOf } from "@/lib/island/scene";
import { lampsOf, sceneryOf } from "@/lib/island/scenery";
import type { Weather } from "@/lib/island/sky";
import { lightOf } from "@/lib/island/sky";
import { pettedOf, touchAt } from "@/lib/island/touch";

/** How many chunks either way of the camera the land keeps made; the window reaches four. */
const KEPT = 6;

/** How many chunks either way of the camera are made ahead of the window, one a frame, so the window's next step only copies them. */
const WARMED = 5;

/** How many rows of the horizon a frame fills once the world has opened: a horizon is ready a couple of seconds after the camera crossed into it, long before its rim comes near. */
const ROWS = 2;

/** The chunk coordinates within `WARMED` chunks of the middle, nearest first, as their offsets from it. */
const RING = Arr.sortWith(
  Arr.flatMap(Arr.range(-WARMED, WARMED), (across) =>
    Arr.map(Arr.range(-WARMED, WARMED), (deep) => [across, deep] as const)
  ),
  ([across, deep]) => Math.max(Math.abs(across), Math.abs(deep)),
  Order.Number
);

/** Lists of bodies with every model once: the bodies of a model that comes more than once joined into one list, as the painter draws a model in one call. */
function gathered(bodies: readonly (readonly [Model, Float32Array])[]) {
  const models = MutableHashMap.empty<
    string,
    readonly [Model, readonly Float32Array[]]
  >();
  for (const [model, places] of bodies) {
    const key = modelKey(model);
    MutableHashMap.set(
      models,
      key,
      Option.match(MutableHashMap.get(models, key), {
        onNone: () => [model, [places]] as const,
        onSome: ([, held]) => [model, Arr.append(held, places)] as const,
      })
    );
  }
  return Arr.map(
    Arr.fromIterable(MutableHashMap.values(models)),
    ([model, lists]) => {
      if (lists.length === 1) {
        return [model, lists[0]] as const;
      }
      const joined = new Float32Array(
        Arr.reduce(lists, 0, (sum, list) => sum + list.length)
      );
      let at = 0;
      for (const list of lists) {
        joined.set(list, at);
        at += list.length;
      }
      return [model, joined] as const;
    }
  );
}

/**
 * One world as the painter shows it (ADR 0050, W9 and W10), for the game and
 * for the home page alike: it keeps the window of land about the camera
 * filled, the life there living, and what stands there, lights it and moves
 * in its air handed to the painter. `regions` answers which stored regions
 * the window reaches, by their keys.
 */
export function createWorld(painter: Painter, land: Land, day: number) {
  const window = windowOf();
  const horizon = windowOf();
  let origin: readonly [number, number] = [Number.NaN, Number.NaN];
  let filled = -1;
  // The horizon being filled: where it is centred, the revision of the land it reads, and the rows filled so far.
  let far: readonly [number, number] = [Number.NaN, Number.NaN];
  let farFilled = -1;
  let rows = WINDOW;
  let opened = false;
  let scene = sceneOf(land, day);

  /** Keeps the horizon about a place: starts it over when the camera crossed into another or the land changed, fills a few rows, and hands it to the painter once it is whole. The first one is filled at once, so the world opens with its horizon. */
  const keepHorizon = (focus: readonly [number, number], revision: number) => {
    const around = horizonOf(focus[0], focus[1]);
    if (
      rows === WINDOW &&
      (around[0] !== far[0] || around[1] !== far[1] || revision !== farFilled)
    ) {
      far = around;
      farFilled = revision;
      rows = 0;
    }
    if (rows === WINDOW) {
      return;
    }
    const to = opened ? Math.min(WINDOW, rows + ROWS) : WINDOW;
    fillHorizon(land, horizon, far, rows, to);
    rows = to;
    if (rows === WINDOW) {
      opened = true;
      painter.horizon(horizon, far);
    }
  };

  /** Makes one chunk the window will reach soon, the nearest missing one first. */
  const warm = () => {
    const cx = Math.floor(origin[0] / CHUNK);
    const cz = Math.floor(origin[1] / CHUNK);
    const missing = Arr.findFirst(
      RING,
      ([across, deep]) =>
        !MutableHashMap.has(land.chunks, keyOf(cx + across, cz + deep))
    );
    if (Option.isSome(missing)) {
      chunkAt(land, cx + missing.value[0], cz + missing.value[1]);
    }
  };

  return {
    /** Draws one frame of the world about `focus`, `seconds` on the clock and `passed` since the last one. */
    frame(next: {
      readonly extra: readonly Animal[];
      readonly focus: readonly [number, number];
      /** Bodies that are not of the scene: the loose things, and the thing in hand under the pointer. */
      readonly ghosts: readonly (readonly [Model, Float32Array])[];
      readonly hour: number;
      readonly orbit: Orbit;
      readonly passed: number;
      readonly revision: number;
      readonly ring: Ring;
      readonly seconds: number;
      readonly weather: Weather;
    }) {
      const around = originOf(next.focus[0], next.focus[1]);
      if (
        around[0] !== origin[0] ||
        around[1] !== origin[1] ||
        next.revision !== filled
      ) {
        origin = around;
        filled = next.revision;
        fillWindow(land, window, origin);
        painter.window(window, origin);
        painter.lamps(lampsOf(land, next.revision, origin));
        painter.scenery(sceneryOf(land, next.revision, origin));
        forgetBeyond(
          land,
          Math.floor(origin[0] / CHUNK),
          Math.floor(origin[1] / CHUNK),
          KEPT
        );
      } else {
        warm();
      }
      keepHorizon(next.focus, next.revision);
      scene = livedOf(
        scene,
        land,
        next.passed,
        next.hour,
        next.focus,
        next.extra
      );
      painter.bodies(
        gathered([
          ...sceneBodies(scene, land, {
            anchor: next.focus,
            extra: next.extra,
            hour: next.hour,
            revision: next.revision,
            seconds: next.seconds,
          }),
          ...next.ghosts,
        ])
      );
      painter.draw(
        next.orbit,
        lightOf(next.hour, next.weather),
        next.seconds,
        next.weather,
        next.ring
      );
    },
    /** The herd as it lives now, which the fox keeps apart from. */
    herd: () => scene.herd,
    /** Strokes an animal of the scene, which stands still and faces the fox for a moment (W6). */
    pet(animal: Animal) {
      scene = pettedOf(scene, animal);
    },
    /** What a ray from the lens meets first among the world's bodies: an animal, a wild plant or a thing, none when it meets only land or sky. */
    touch: (ray: Parameters<typeof touchAt>[2]) => touchAt(scene, land, ray),
    /** The stored regions the window about a place reaches, by their keys. */
    regions(x: number, z: number) {
      const [ox, oz] = originOf(x, z);
      return Arr.dedupe(
        Arr.map(
          [
            [-1, -1],
            [1, -1],
            [-1, 1],
            [1, 1],
          ] as const,
          ([across, deep]) =>
            keyOf(
              regionOf(Math.floor((ox + (across * WINDOW) / 2) / CHUNK)),
              regionOf(Math.floor((oz + (deep * WINDOW) / 2) / CHUNK))
            )
        )
      );
    },
  };
}
