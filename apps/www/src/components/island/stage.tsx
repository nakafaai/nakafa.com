"use client";

import { keyOf } from "@repo/backend/confect/island/blocks";
import { useRequired } from "@repo/design-system/hooks/required";
import { createFramePace } from "@repo/design-system/lib/pace";
import {
  Array as Arr,
  DateTime,
  HashSet,
  MutableHashMap,
  Option,
  Result,
} from "effect";
import { useState } from "react";
import { createPainter, type Painter } from "@/components/island/draw";
import { createFox } from "@/components/island/fox";
import { bindInput } from "@/components/island/input";
import { cursorOf } from "@/components/island/picture";
import { createRod } from "@/components/island/rod";
import {
  type GameStoreApi,
  GameStoreContext,
  heldOf,
} from "@/components/island/store";
import { bodiesOf, seaBodies } from "@/lib/island/bodies";
import {
  clampOrbit,
  easeOrbit,
  type Orbit,
  openingOrbit,
} from "@/lib/island/camera";
import { hoeOf, ripeningOf, sownOf, waterOf } from "@/lib/island/farming";
import type { Point } from "@/lib/island/gesture";
import { columnsOf } from "@/lib/island/ground";
import { islesMesh } from "@/lib/island/isles";
import { itemPlanOf, turnOf } from "@/lib/island/items";
import { flatQuads, herdOf, wander } from "@/lib/island/life";
import { changedChunks, glowOf } from "@/lib/island/light";
import { rayThrough } from "@/lib/island/matrix";
import { lightingOf, meshChunk } from "@/lib/island/mesh";
import { firefliesOf } from "@/lib/island/night";
import { planOf } from "@/lib/island/plan";
import { plantBodies } from "@/lib/island/plants";
import { castRay } from "@/lib/island/ray";
import { shoreOf } from "@/lib/island/shore";
import { hourOf, lightOf } from "@/lib/island/sky";
import { chimneysOf } from "@/lib/island/smoke";
import { roam, wildBodies, wildOf } from "@/lib/island/wild";
import { type Cells, CHUNKS, SEA_LEVEL } from "@/lib/island/world";

/**
 * The island's world on the whole screen (ADR 0047, D1, D2 and D5): the canvas
 * the painter draws into, the loop that redraws it when something moved, and
 * the gestures that move the camera and build. It starts once the canvas
 * exists and stops when it leaves.
 */
export function IslandStage({ size }: { size: number }) {
  const store = useRequired(GameStoreContext, "IslandStage");
  const [failed, setFailed] = useState(false);
  return failed ? (
    <p className="text-paper absolute inset-0 grid place-items-center p-8 text-center">
      WebGL2
    </p>
  ) : (
    <canvas
      className="absolute inset-0 block size-full touch-none select-none [image-rendering:pixelated]"
      data-testid="island-stage"
      onContextMenu={(event) => event.preventDefault()}
      ref={(canvas) => {
        if (canvas === null) {
          return;
        }
        const painter = createPainter(canvas, store.getState().season);
        if (Option.isNone(painter)) {
          setFailed(true);
          return;
        }
        return start(canvas, painter.value, store, size);
      }}
    />
  );
}

/** Runs the game on one canvas until the returned cleanup stops it. */
function start(
  canvas: HTMLCanvasElement,
  painter: Painter,
  store: GameStoreApi,
  size: number
) {
  let orbit: Orbit = openingOrbit(
    size,
    canvas.clientWidth / Math.max(1, canvas.clientHeight)
  );
  let goal: Orbit = orbit;
  let needsDraw = true;
  let frame = 0;
  let lastWater = 0;

  let glow = glowOf(store.getState().cells);
  // Every plant as its model (D25), read again only when the world changes.
  let plants = plantBodies(store.getState().cells);
  let herd = herdOf(store.getState().cells, store.getState().seed, size);
  // The wild visitors change with the day, so the island meets new species as the days go by (ADR 0047, D11).
  let wild = wildOf(
    store.getState().cells,
    store.getState().seed,
    size,
    Math.floor(DateTime.toEpochMillis(DateTime.nowUnsafe()) / 86_400_000)
  );
  let lastLife = 0;
  const fox = createFox(store, canvas);
  const remesh = (chunks: Iterable<number>) => {
    const { cells } = store.getState();
    const lighting = lightingOf(cells, glow);
    for (const index of chunks) {
      painter.upload(
        index,
        meshChunk(cells, lighting, index % CHUNKS, Math.floor(index / CHUNKS))
      );
    }
    painter.shore(shoreOf(cells, store.getState().seed, true));
    painter.columns(columnsOf(cells));
    painter.scenery({
      chimneys: chimneysOf(cells),
      fireflies: firefliesOf(cells, store.getState().seed),
    });
    needsDraw = true;
  };
  painter.isles(islesMesh(store.getState().seed));
  remesh(Arr.makeBy(CHUNKS * CHUNKS, (index) => index));

  /** Shows the cursor of the hand the learner holds, or a grabbing hand while they drag the world. */
  const showCursor = (dragging: boolean) => {
    const { hotbar, slot, tool } = store.getState();
    canvas.style.cursor = dragging ? "grabbing" : cursorOf(tool, hotbar[slot]);
  };
  showCursor(false);

  const unsubscribe = store.subscribe((state, previous) => {
    if (
      state.tool !== previous.tool ||
      state.slot !== previous.slot ||
      state.hotbar !== previous.hotbar
    ) {
      showCursor(false);
    }
    if (state.revision !== previous.revision) {
      // A changed block can move light far past its own chunk, so every chunk whose light moved is meshed again too.
      const relit = glowOf(state.cells);
      const moved = changedChunks(glow, relit);
      glow = relit;
      plants = plantBodies(state.cells);
      remesh(HashSet.union(store.getState().takeDirty(), moved));
      canvas.dataset.revision = String(state.revision);
    }
    if (state.weather !== previous.weather) {
      needsDraw = true;
    }
    // A change the learner just made throws its dust or chips (D38).
    if (state.pending.length > previous.pending.length) {
      Option.map(Arr.last(state.pending), (edit) =>
        painter.burst(
          [edit.x, edit.y, edit.z],
          edit.after === 0 ? edit.before : edit.after,
          edit.after === 0,
          performance.now() / 1000
        )
      );
    }
  });

  /** What a ray through a point of the screen meets first, none when it meets nothing. */
  const hitAt = (point: Point) => {
    const rect = canvas.getBoundingClientRect();
    const ray = rayThrough(
      orbit,
      rect.width / rect.height,
      ((point.x - rect.left) / rect.width) * 2 - 1,
      1 - ((point.y - rect.top) / rect.height) * 2
    );
    return castRay(store.getState().cells, ray.origin, ray.direction);
  };

  /** The edit a press at a point of the screen would make, none when it would make none. */
  const planAt = (point: Point, remove: boolean) => {
    const state = store.getState();
    return Option.flatMap(hitAt(point), (hit) =>
      planOf(state.cells, hit, remove ? 0 : heldOf(state), size)
    );
  };

  // The learner's fishing rod (ADR 0047, D15).
  const rod = createRod(store);

  /** Tills, harvests or waters at a point of the screen (D16), or says what the tool needs. */
  const farm = (point: Point, tool: "hoe" | "can") => {
    const state = store.getState();
    Option.map(hitAt(point), (hit) => {
      if (tool === "can") {
        Option.match(waterOf(state.cells, hit.hit), {
          onNone: () => state.setNotice("water"),
          onSome: (edit) => state.apply([edit]),
        });
        return;
      }
      Option.match(hoeOf(state.cells, hit.hit), {
        onNone: () => state.setNotice("till"),
        onSome: (edits) => {
          Option.map(
            Option.flatMap(Arr.head(edits), (first) =>
              first.after === 0 ? keyOf(first.before) : Option.none()
            ),
            state.harvest
          );
          state.apply(edits);
        },
      });
    });
  };

  /**
   * Builds or digs at a point of the screen. With an item in hand it builds the
   * whole item there, its front to the camera, as one step undo takes back, or
   * says there is no room for it (ADR 0047, D10).
   */
  const act = (point: Point, remove: boolean) => {
    const state = store.getState();
    aim = Option.none();
    if ((state.tool === "hoe" || state.tool === "can") && !remove) {
      farm(point, state.tool);
      return;
    }
    if (state.tool === "fish" && !remove) {
      needsDraw = true;
      rod.press(hitAt(point), [fox.at().x, fox.at().z]);
      return;
    }
    if (state.tool === "walk" && !remove) {
      Option.map(hitAt(point), (hit) => {
        needsDraw = fox.walkTo([hit.hit[0], hit.hit[2]]) || needsDraw;
      });
      return;
    }
    if (state.tool === "item" && !remove) {
      Option.map(hitAt(point), (hit) =>
        Result.match(
          itemPlanOf(
            state.cells,
            state.item,
            hit.place,
            turnOf(orbit.yaw),
            size
          ),
          {
            onFailure: () => state.setNotice("room"),
            onSuccess: (edits) => state.apply(edits),
          }
        )
      );
      return;
    }
    Option.map(planAt(point, remove), (edit) =>
      state.apply([
        {
          ...edit,
          after: sownOf(state.cells, [edit.x, edit.y, edit.z], edit.after),
        },
      ])
    );
  };

  // Sprouts on wet soil and how long each has grown (D16), checked every two seconds of play.
  const sprouts = MutableHashMap.empty<number, number>();
  let lastGrowth = 0;
  /** Ripens every sprout that has grown long enough on wet soil, as edits no undo takes back. */
  const growCrops = (seconds: number) => {
    store.getState().grow(ripeningOf(store.getState().cells, sprouts, seconds));
  };

  /** Hands the painter every creature this frame as true 3D bodies: the herd and the fox facing its way or its float (D21), the open sea's swimmers (D24), the wild visitors and the plants (D25); then Nina and the float, still flat. */
  const drawLife = (
    cells: Cells,
    next: Option.Option<readonly [number, number]>,
    seconds: number
  ) => {
    // The fox faces where it walks, or its float while it fishes.
    const facing = Option.getOrElse(
      Option.orElse(
        Option.map(next, ([cx, cz]) => [cx + 0.5, cz + 0.5] as const),
        rod.float
      ),
      () => [fox.at().x, fox.at().z] as const
    );
    painter.bodies([
      ...bodiesOf(
        cells,
        Arr.append(herd, fox.animal(facing[0], facing[1])),
        seconds
      ),
      ...seaBodies(store.getState().seed, seconds),
      ...wildBodies(cells, wild, size, seconds),
      ...plants,
    ]);
    painter.herd(flatQuads(size, seconds, rod.quads(seconds, orbit.yaw)));
  };

  /** The cell a hovering mouse would change, outlined before it presses (D5). */
  let aim: Option.Option<readonly [number, number, number]> = Option.none();

  // The world moving by itself, its water and its wandering life, keeps to its
  // share of the thread on a slow phone (ADR 0047, D26); the learner's own
  // moves still draw at once.
  const pace = createFramePace();
  /** Whether the world moving by itself is due a frame: its water every 66 ms, or 33 in rain or snow, when the pace allows. */
  const ambientDue = (now: number) => {
    const { weather } = store.getState();
    const falling =
      weather === "rain" || weather === "storm" || weather === "snow";
    return now - lastWater > (falling ? 33 : 66) && pace.isDue(now);
  };
  const tick = (now: number) => {
    frame = requestAnimationFrame(tick);
    input.tend(now);
    const moving =
      Math.abs(goal.yaw - orbit.yaw) > 1e-3 ||
      Math.abs(goal.distance - orbit.distance) > 1e-2 ||
      Math.abs(goal.target[0] - orbit.target[0]) > 1e-2 ||
      Math.abs(goal.target[2] - orbit.target[2]) > 1e-2;
    if (moving) {
      orbit = easeOrbit(orbit, goal, 0.25);
      needsDraw = true;
    }
    const { weather } = store.getState();
    const waterDue = ambientDue(now);
    if (
      !(needsDraw || waterDue || fox.walking() || rod.active()) ||
      document.hidden
    ) {
      return;
    }
    lastWater = now;
    needsDraw = false;
    const dt = lastLife === 0 ? 0 : Math.min(0.25, (now - lastLife) / 1000);
    lastLife = now;
    const { cells, seed } = store.getState();
    const everyone = Arr.append(herd, fox.animal());
    herd = Arr.map(herd, (animal, index) =>
      wander(cells, animal, seed, index, dt, everyone)
    );
    wild = Arr.map(wild, (creature) => roam(cells, creature, seed, dt));
    const { moved, next } = fox.advance(dt, herd);
    if (moved) {
      // The camera keeps the walking fox in view.
      goal = { ...goal, target: [fox.at().x, SEA_LEVEL + 1, fox.at().z] };
    }
    if (now - lastGrowth > 2000) {
      lastGrowth = now;
      growCrops(now / 1000);
    }
    rod.tend(now / 1000);
    canvas.dataset.fishing = rod.active() ? "true" : "false";
    drawLife(cells, next, now / 1000);
    const hour = hourOf(DateTime.nowUnsafe(), DateTime.zoneMakeLocal());
    const minute = Math.floor(hour * 60) % (24 * 60);
    if (minute !== store.getState().minute) {
      store.getState().setMinute(minute);
    }
    painter.draw(orbit, lightOf(hour, weather), now / 1000, weather, aim);
    canvas.dataset.drawn = "true";
    canvas.dataset.weather = weather;
    pace.rest(now);
  };
  frame = requestAnimationFrame(tick);

  const resize = new ResizeObserver(() => {
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * ratio));
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * ratio));
    needsDraw = true;
  });
  resize.observe(canvas);

  const input = bindInput(canvas, store, {
    camera: () => ({ goal, orbit }),
    drag: showCursor,
    hover: (point) => {
      const remove = store.getState().tool === "remove";
      aim = Option.map(
        Option.flatMap(point, (at) => planAt(at, remove)),
        (edit) => [edit.x, edit.y, edit.z] as const
      );
      needsDraw = true;
    },
    move: (next, eased = false) => {
      goal = clampOrbit(next);
      if (!eased) {
        orbit = goal;
      }
      needsDraw = true;
    },
    press: act,
    step: (across, ahead) => {
      needsDraw = fox.step(across, ahead, orbit.yaw) || needsDraw;
    },
  });

  return () => {
    cancelAnimationFrame(frame);
    resize.disconnect();
    unsubscribe();
    input.release();
    painter.release();
  };
}
