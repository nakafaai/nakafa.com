"use client";

import { keyOf } from "@repo/backend/confect/island/blocks";
import { SPAN } from "@repo/backend/confect/island/world";
import { createFramePace } from "@repo/design-system/lib/pace";
import {
  Array as Arr,
  DateTime,
  HashSet,
  MutableHashMap,
  Option,
  Result,
} from "effect";
import { use, useState } from "react";
import { createPainter, type Painter } from "@/components/island/draw";
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
import { islesMesh } from "@/lib/island/isles";
import { itemPlanOf, turnOf } from "@/lib/island/items";
import { type Animal, flatQuads, herdOf, wander } from "@/lib/island/life";
import { changedChunks, glowOf } from "@/lib/island/light";
import { rayThrough } from "@/lib/island/matrix";
import { lightingOf, meshChunk } from "@/lib/island/mesh";
import { pathOf } from "@/lib/island/path";
import { planOf } from "@/lib/island/plan";
import { plantBodies } from "@/lib/island/plants";
import { castRay } from "@/lib/island/ray";
import { touches } from "@/lib/island/room";
import { hourOf, lightOf } from "@/lib/island/sky";
import { roam, wildBodies, wildOf } from "@/lib/island/wild";
import { type Cells, CHUNKS, SEA_LEVEL } from "@/lib/island/world";

/**
 * The island's world on the whole screen (ADR 0047, D1, D2 and D5): the canvas
 * the painter draws into, the loop that redraws it when something moved, and
 * the gestures that move the camera and build. It starts once the canvas
 * exists and stops when it leaves.
 */
export function IslandStage({ size }: { size: number }) {
  const store = use(GameStoreContext);
  const [failed, setFailed] = useState(false);
  if (store === null) {
    throw new Error("IslandStage must be used within the island game");
  }
  return failed ? (
    <p className="absolute inset-0 grid place-items-center p-8 text-center text-white">
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

/** How fast the learner's fox walks, in cells a second. */
const WALK_SPEED = 3.2;

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
  // The learner's own fox (ADR 0047, D12): it starts on the village square and walks where the learner sends it.
  let walker = { x: SPAN / 2 + 0.5, z: SPAN / 2 + 2.5 };
  let route: readonly (readonly [number, number])[] = [];
  canvas.dataset.player = `${Math.floor(walker.x)},${Math.floor(walker.z)}`;
  const remesh = (chunks: Iterable<number>) => {
    const { cells } = store.getState();
    const lighting = lightingOf(cells, glow);
    for (const index of chunks) {
      painter.upload(
        index,
        meshChunk(cells, lighting, index % CHUNKS, Math.floor(index / CHUNKS))
      );
    }
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

  /** Sends the fox along the shortest way to a column, or says no way leads there. */
  const walkTo = (column: readonly [number, number]) => {
    Option.match(
      pathOf(
        store.getState().cells,
        [Math.floor(walker.x), Math.floor(walker.z)],
        column
      ),
      {
        onNone: () => store.getState().setNotice("path"),
        onSome: (found) => {
          route = found;
          needsDraw = true;
        },
      }
    );
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
      rod.press(hitAt(point), [walker.x, walker.z]);
      return;
    }
    if (state.tool === "walk" && !remove) {
      Option.map(hitAt(point), (hit) => walkTo([hit.hit[0], hit.hit[2]]));
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

  /** Moves the fox along its route for `dt` seconds, keeps the camera on it, and answers the cell it heads for. */
  /** The learner's fox as an animal at (x, z), heading for (tx, tz), for the checks that keep bodies apart. */
  const foxAt = (x: number, z: number, tx = x, tz = z): Animal => ({
    kind: "fox",
    rest: 1,
    steps: 0,
    tx,
    tz,
    x,
    z,
  });

  const stepWalker = (dt: number) => {
    const next = Arr.head(route);
    Option.map(next, ([cx, cz]) => {
      const dx = cx + 0.5 - walker.x;
      const dz = cz + 0.5 - walker.z;
      const distance = Math.hypot(dx, dz);
      const reach = WALK_SPEED * dt;
      const stepTo =
        distance <= reach
          ? { x: cx + 0.5, z: cz + 0.5 }
          : {
              x: walker.x + (dx / distance) * reach,
              z: walker.z + (dz / distance) * reach,
            };
      // The fox waits for an animal in its way instead of walking through it (D22).
      const stepped = foxAt(stepTo.x, stepTo.z, cx + 0.5, cz + 0.5);
      const nearer = (animal: Animal) =>
        Math.hypot(stepTo.x - animal.x, stepTo.z - animal.z) <
        Math.hypot(walker.x - animal.x, walker.z - animal.z);
      if (
        Arr.some(herd, (animal) => nearer(animal) && touches(stepped, animal))
      ) {
        return;
      }
      walker = stepTo;
      if (distance <= reach) {
        route = Arr.drop(route, 1);
      }
      // The camera keeps the walking fox in view.
      goal = { ...goal, target: [walker.x, SEA_LEVEL + 1, walker.z] };
      canvas.dataset.player = `${Math.floor(walker.x)},${Math.floor(walker.z)}`;
    });
    return next;
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
      () => [walker.x, walker.z] as const
    );
    const fox = {
      ...foxAt(walker.x, walker.z, facing[0], facing[1]),
      rest: route.length > 0 ? 0 : 1,
    };
    painter.bodies([
      ...bodiesOf(cells, Arr.append(herd, fox), seconds),
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
      !(needsDraw || waterDue || route.length > 0 || rod.active()) ||
      document.hidden
    ) {
      return;
    }
    lastWater = now;
    needsDraw = false;
    const dt = lastLife === 0 ? 0 : Math.min(0.25, (now - lastLife) / 1000);
    lastLife = now;
    const { cells, seed } = store.getState();
    const everyone = Arr.append(herd, foxAt(walker.x, walker.z));
    herd = Arr.map(herd, (animal, index) =>
      wander(cells, animal, seed, index, dt, everyone)
    );
    wild = Arr.map(wild, (creature) => roam(cells, creature, seed, dt));
    const next = stepWalker(dt);
    canvas.dataset.walking = route.length > 0 ? "true" : "false";
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
    pace.rest(now, performance.now());
  };
  frame = requestAnimationFrame(tick);

  const resize = new ResizeObserver(() => {
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * ratio));
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * ratio));
    needsDraw = true;
  });
  resize.observe(canvas);

  /** Walks the fox one cell, right (`across`) or away from the camera (`ahead` negative), as the camera faces. */
  const step = (across: number, ahead: number) => {
    const quarter = turnOf(orbit.yaw);
    const [dx, dz] = [
      [across, ahead],
      [ahead, -across],
      [-across, -ahead],
      [-ahead, across],
    ][quarter];
    const last = Arr.last(route).pipe(
      Option.getOrElse(
        () => [Math.floor(walker.x), Math.floor(walker.z)] as const
      )
    );
    walkTo([last[0] + dx, last[1] + dz]);
  };

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
    step,
  });

  return () => {
    cancelAnimationFrame(frame);
    resize.disconnect();
    unsubscribe();
    input.release();
    painter.release();
  };
}
