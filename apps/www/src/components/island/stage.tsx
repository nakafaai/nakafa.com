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
import type { Painter } from "@/components/island/draw";
import { createPainter } from "@/components/island/draw";
import { createFox } from "@/components/island/fox";
import { bindInput } from "@/components/island/input";
import { cursorOf } from "@/components/island/picture";
import { createRod } from "@/components/island/rod";
import type { GameStoreApi } from "@/components/island/store";
import { GameStoreContext, heldOf } from "@/components/island/store";
import type { Orbit } from "@/lib/island/camera";
import {
  clampOrbit,
  easeOrbit,
  easeShare,
  openingOrbit,
  turnOrbit,
} from "@/lib/island/camera";
import { hoeOf, ripeningOf, sownOf, waterOf } from "@/lib/island/farming";
import { flatQuads } from "@/lib/island/flat";
import type { Point, Spin } from "@/lib/island/gesture";
import { fadeSpin, isSpinning, STILL_SPIN } from "@/lib/island/gesture";
import { islesMesh } from "@/lib/island/isles";
import { itemPlanOf, turnOf } from "@/lib/island/items";
import { changedChunks, glowOf } from "@/lib/island/light";
import { rayThrough } from "@/lib/island/matrix";
import { lightingOf, meshChunk } from "@/lib/island/mesh";
import { planOf } from "@/lib/island/plan";
import { RUNGS, stepLadder, TOP_RUNG } from "@/lib/island/quality";
import { castRay } from "@/lib/island/ray";
import { livedOf, rerootedOf, sceneBodies, sceneOf } from "@/lib/island/scene";
import { hourOf, lightOf } from "@/lib/island/sky";
import type { Cells } from "@/lib/island/world";
import { CHUNKS, SEA_LEVEL } from "@/lib/island/world";

/**
 * The island's world on the whole screen (ADR 0047, D1, D2 and D5): the canvas
 * the painter draws into, the loop that redraws it when something moved, and
 * the gestures that move the camera and build. It starts once the canvas
 * exists and stops when it leaves.
 */
export function IslandStage({ size }: { size: number }) {
  const store = useRequired(GameStoreContext, "IslandStage");
  const [failed, setFailed] = useState(false);
  const [context, setContext] = useState(0);
  return failed ? (
    <p className="text-paper absolute inset-0 grid place-items-center p-8 text-center">
      WebGL2
    </p>
  ) : (
    <canvas
      className="absolute inset-0 block size-full touch-none select-none [image-rendering:pixelated]"
      data-testid="island-stage"
      // A canvas whose WebGL context came back starts over on a new one: the world lives in the store, so nothing built is lost.
      key={context}
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
        return start(canvas, painter.value, store, size, () =>
          setContext((value) => value + 1)
        );
      }}
    />
  );
}

/** Runs the game on one canvas until the returned cleanup stops it. */
function start(
  canvas: HTMLCanvasElement,
  painter: Painter,
  store: GameStoreApi,
  size: number,
  restart: () => void
) {
  let orbit: Orbit = openingOrbit(
    size,
    canvas.clientWidth / Math.max(1, canvas.clientHeight)
  );
  let goal: Orbit = orbit;
  /** The turn a drag left the world with, which fades on its own (ADR 0047, D5). */
  let spin: Spin = STILL_SPIN;
  /** When the camera last moved, so it eases by the time that passed, alike at any frame rate. */
  let lastCamera = 0;
  let needsDraw = true;
  let frame = 0;
  let lastWater = 0;

  let glow = glowOf(store.getState().cells);
  // Everything alive on the island, the same scene the home page shows (D53): its plants and reef read again only when
  // the world changes, and the wild visitors changing with the day, so the island meets new species as the days go by (D11).
  let scene = sceneOf(
    store.getState().cells,
    store.getState().seed,
    size,
    Math.floor(DateTime.toEpochMillis(DateTime.nowUnsafe()) / 86_400_000)
  );
  let lastLife = 0;
  // The quality ladder (D44) reads only frames drawn on two ticks in a row, so a resting island's slow pace never counts as slow.
  let ladder = TOP_RUNG;
  let lastTick = 0;
  let drewLast = false;
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
    painter.world(cells, store.getState().seed);
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
      scene = rerootedOf(scene, state.cells);
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

  /** Hands the painter every creature this frame as true 3D bodies: the herd and the fox facing its way or its float (D21), the open sea's swimmers (D24), the wild visitors and the plants (D25), the reef and its residents (D50); then Nina and the float, still flat. */
  const drawLife = (
    cells: Cells,
    next: Option.Option<readonly [number, number]>,
    seconds: number,
    hour: number
  ) => {
    // The fox faces where it walks, or its float while it fishes.
    const facing = Option.getOrElse(
      Option.orElse(
        Option.map(next, ([cx, cz]) => [cx + 0.5, cz + 0.5] as const),
        rod.float
      ),
      () => [fox.at().x, fox.at().z] as const
    );
    painter.bodies(
      sceneBodies({ ...scene, cells }, seconds, hour, [
        fox.animal(facing[0], facing[1]),
      ])
    );
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
  /**
   * Moves the drawn camera on by the time since the last frame: a spin the
   * learner's drag left turns it and fades, and otherwise it closes on its
   * goal at the same pace at any frame rate. Whether it moved.
   */
  const followCamera = (now: number) => {
    const seconds = lastCamera === 0 ? 0 : (now - lastCamera) / 1000;
    lastCamera = now;
    if (isSpinning(spin)) {
      const step = Math.min(1 / 15, seconds);
      goal = turnOrbit(goal, spin.yaw * step, spin.pitch * step);
      orbit = goal;
      spin = fadeSpin(spin, step);
      return true;
    }
    const moving =
      Math.abs(goal.yaw - orbit.yaw) > 1e-3 ||
      Math.abs(goal.distance - orbit.distance) > 1e-2 ||
      Math.abs(goal.target[0] - orbit.target[0]) > 1e-2 ||
      Math.abs(goal.target[2] - orbit.target[2]) > 1e-2;
    if (moving) {
      orbit = easeOrbit(orbit, goal, easeShare(seconds));
    }
    return moving;
  };
  /** Feeds the quality ladder a frame drawn right after another (D44), and steps the painter down a rung when it says so. */
  const measure = (seconds: number) => {
    const next = stepLadder(ladder, seconds);
    if (next.rung !== ladder.rung) {
      painter.quality(RUNGS[next.rung]);
      canvas.dataset.quality = String(next.rung);
    }
    ladder = next;
  };
  const tick = (now: number) => {
    frame = requestAnimationFrame(tick);
    const sinceTick = (now - lastTick) / 1000;
    lastTick = now;
    input.tend(now);
    if (followCamera(now)) {
      needsDraw = true;
    }
    const { weather } = store.getState();
    const waterDue = ambientDue(now);
    if (
      !(needsDraw || waterDue || fox.walking() || rod.active()) ||
      document.hidden
    ) {
      drewLast = false;
      return;
    }
    if (drewLast) {
      measure(sinceTick);
    }
    drewLast = true;
    lastWater = now;
    needsDraw = false;
    const dt = lastLife === 0 ? 0 : Math.min(0.25, (now - lastLife) / 1000);
    lastLife = now;
    const { cells } = store.getState();
    // The island's hour, which lights the world and keeps the villagers' day (D54).
    const hour = hourOf(DateTime.nowUnsafe(), DateTime.zoneMakeLocal());
    scene = livedOf({ ...scene, cells }, dt, hour, [fox.animal()]);
    const { moved, next } = fox.advance(dt, scene.herd);
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
    drawLife(cells, next, now / 1000, hour);
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
    // Every device pixel, so the browser never stretches the canvas by a fraction: the frame is enlarged by whole art pixels (D20).
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * ratio));
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * ratio));
    needsDraw = true;
  });
  resize.observe(canvas);

  // The browser gives a lost context back only to a page that asked to keep it.
  const keep = (event: Event) => event.preventDefault();
  canvas.addEventListener("webglcontextlost", keep);
  canvas.addEventListener("webglcontextrestored", restart);

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
    spin: (next) => {
      spin = next;
    },
    step: (across, ahead) => {
      needsDraw = fox.step(across, ahead, orbit.yaw) || needsDraw;
    },
  });

  return () => {
    cancelAnimationFrame(frame);
    resize.disconnect();
    canvas.removeEventListener("webglcontextlost", keep);
    canvas.removeEventListener("webglcontextrestored", restart);
    unsubscribe();
    input.release();
    painter.release();
  };
}
