"use client";

import {
  Array as Arr,
  DateTime,
  MutableHashMap,
  Option,
  Record as Rec,
} from "effect";
import { use, useState } from "react";
import { createPainter, type Painter } from "@/components/island/draw";
import {
  type GameStoreApi,
  GameStoreContext,
  heldOf,
} from "@/components/island/store";
import {
  clampOrbit,
  easeOrbit,
  type Orbit,
  openingOrbit,
  panOrbit,
  turnOrbit,
  zoomOrbit,
} from "@/lib/island/camera";
import {
  distanceOf,
  isTap,
  LONG_PRESS,
  type Point,
  type Press,
  pinchOf,
  wheelZoomOf,
} from "@/lib/island/gesture";
import { rayThrough } from "@/lib/island/matrix";
import { lightingOf, meshChunk } from "@/lib/island/mesh";
import { castRay } from "@/lib/island/ray";
import { lightOf } from "@/lib/island/sky";
import { CHUNKS, cellOf, footprintOf, isInside } from "@/lib/island/world";

/** The hour of the learner's own clock, from 0 to 24. */
function localHour() {
  const now = DateTime.setZone(DateTime.nowUnsafe(), DateTime.zoneMakeLocal());
  return DateTime.getPart(now, "hour") + DateTime.getPart(now, "minute") / 60;
}

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
        const painter = createPainter(canvas);
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
  const footprint = footprintOf(size);
  const presses = MutableHashMap.empty<number, Press>();

  const remesh = (chunks: Iterable<number>) => {
    const { cells } = store.getState();
    const lighting = lightingOf(cells);
    for (const index of chunks) {
      painter.upload(
        index,
        meshChunk(cells, lighting, index % CHUNKS, Math.floor(index / CHUNKS))
      );
    }
    needsDraw = true;
  };
  remesh(Arr.makeBy(CHUNKS * CHUNKS, (index) => index));

  const unsubscribe = store.subscribe((state, previous) => {
    if (state.revision !== previous.revision) {
      remesh(store.getState().takeDirty());
      canvas.dataset.revision = String(state.revision);
    }
  });

  /** Builds or digs at a point of the screen. */
  const act = (point: Point, remove: boolean) => {
    const rect = canvas.getBoundingClientRect();
    const ray = rayThrough(
      orbit,
      rect.width / rect.height,
      ((point.x - rect.left) / rect.width) * 2 - 1,
      1 - ((point.y - rect.top) / rect.height) * 2
    );
    const state = store.getState();
    Option.map(
      castRay(state.cells, ray.origin, ray.direction),
      ({ block, hit, place }) => {
        const within = (x: number, z: number) =>
          x >= footprint.from &&
          x <= footprint.to &&
          z >= footprint.from &&
          z <= footprint.to;
        const held = heldOf(state);
        if (remove || held === 0) {
          if (hit[1] >= 1 && within(hit[0], hit[2])) {
            state.apply([
              { after: 0, before: block, x: hit[0], y: hit[1], z: hit[2] },
            ]);
          }
          return;
        }
        const into = block === 11 ? hit : place;
        if (isInside(...into) && into[1] >= 1 && within(into[0], into[2])) {
          const before = state.cells[cellOf(...into)];
          if (before !== held) {
            state.apply([
              { after: held, before, x: into[0], y: into[1], z: into[2] },
            ]);
          }
        }
      }
    );
  };

  const tick = (now: number) => {
    frame = requestAnimationFrame(tick);
    const moving =
      Math.abs(goal.yaw - orbit.yaw) > 1e-3 ||
      Math.abs(goal.distance - orbit.distance) > 1e-2;
    if (moving) {
      orbit = easeOrbit(orbit, goal, 0.25);
      needsDraw = true;
    }
    const waterDue = now - lastWater > 66;
    if (!(needsDraw || waterDue) || document.hidden) {
      return;
    }
    lastWater = now;
    needsDraw = false;
    painter.draw(orbit, lightOf(localHour(), "clear"), now / 1000);
    canvas.dataset.drawn = "true";
  };
  frame = requestAnimationFrame(tick);

  const resize = new ResizeObserver(() => {
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * ratio));
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * ratio));
    needsDraw = true;
  });
  resize.observe(canvas);

  const move = (next: Orbit, eased = false) => {
    goal = clampOrbit(next);
    if (!eased) {
      orbit = goal;
    }
    needsDraw = true;
  };

  /** Marks every press as used, so none of them builds when it lifts. */
  const spendPresses = () => {
    MutableHashMap.forEach(presses, (press, id) =>
      MutableHashMap.set(presses, id, { ...press, used: true })
    );
  };
  const onDown = (event: PointerEvent) => {
    canvas.setPointerCapture(event.pointerId);
    spendPresses();
    const point = { x: event.clientX, y: event.clientY };
    const id = event.pointerId;
    MutableHashMap.set(presses, id, {
      at: event.timeStamp,
      button: event.button,
      last: point,
      moved: 0,
      start: point,
      used: MutableHashMap.size(presses) > 0,
    });
    // A press held still digs out the block under it, without waiting for the lift.
    window.setTimeout(() => {
      Option.map(MutableHashMap.get(presses, id), (press) => {
        if (press.used || press.moved >= 8) {
          return;
        }
        MutableHashMap.set(presses, id, { ...press, used: true });
        act(press.start, true);
      });
    }, LONG_PRESS);
  };
  const onMove = (event: PointerEvent) => {
    const found = MutableHashMap.get(presses, event.pointerId);
    if (Option.isNone(found)) {
      return;
    }
    const press = found.value;
    const point = { x: event.clientX, y: event.clientY };
    const other = Arr.findFirst(
      Arr.fromIterable(MutableHashMap.values(presses)),
      (entry) => entry !== press
    );
    if (Option.isSome(other)) {
      const pinch = pinchOf(
        [press.last, other.value.last],
        [point, other.value.last]
      );
      const panned = panOrbit(orbit, pinch.dx, pinch.dy, canvas.clientHeight);
      move(turnOrbit(zoomOrbit(panned, pinch.zoom), -pinch.twist));
    } else if (press.button === 2 || event.shiftKey) {
      const dx = point.x - press.last.x;
      const dy = point.y - press.last.y;
      move(turnOrbit(orbit, -dx * 0.01, dy * 0.006));
    } else {
      move(
        panOrbit(
          orbit,
          point.x - press.last.x,
          point.y - press.last.y,
          canvas.clientHeight
        )
      );
    }
    MutableHashMap.set(presses, event.pointerId, {
      ...press,
      last: point,
      moved: Math.max(press.moved, distanceOf(press.start, point)),
    });
  };
  const onUp = (event: PointerEvent) => {
    const found = MutableHashMap.get(presses, event.pointerId);
    MutableHashMap.remove(presses, event.pointerId);
    Option.map(found, (press) => {
      if (!press.used && isTap(press.moved, event.timeStamp - press.at)) {
        act(press.start, press.button === 2);
      }
    });
  };
  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    move(zoomOrbit(goal, wheelZoomOf(event.deltaY)), true);
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }
    const height = canvas.clientHeight;
    const keys: Record<string, () => void> = {
      "+": () => move(zoomOrbit(goal, 0.85), true),
      "-": () => move(zoomOrbit(goal, 1.18), true),
      a: () => move(panOrbit(orbit, 24, 0, height)),
      arrowdown: () => move(panOrbit(orbit, 0, -24, height)),
      arrowleft: () => move(panOrbit(orbit, 24, 0, height)),
      arrowright: () => move(panOrbit(orbit, -24, 0, height)),
      arrowup: () => move(panOrbit(orbit, 0, 24, height)),
      d: () => move(panOrbit(orbit, -24, 0, height)),
      e: () => move(turnOrbit(goal, -Math.PI / 4), true),
      q: () => move(turnOrbit(goal, Math.PI / 4), true),
      s: () => move(panOrbit(orbit, 0, -24, height)),
      w: () => move(panOrbit(orbit, 0, 24, height)),
    };
    const digit = Number.parseInt(event.key, 10);
    if (digit >= 1 && digit <= store.getState().hotbar.length) {
      store.getState().choose(digit - 1);
      return;
    }
    Option.map(Rec.get(keys, event.key.toLowerCase()), (handler) => {
      event.preventDefault();
      handler();
    });
  };

  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("keydown", onKey);

  return () => {
    cancelAnimationFrame(frame);
    resize.disconnect();
    unsubscribe();
    canvas.removeEventListener("pointerdown", onDown);
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerup", onUp);
    canvas.removeEventListener("pointercancel", onUp);
    canvas.removeEventListener("wheel", onWheel);
    window.removeEventListener("keydown", onKey);
    painter.release();
  };
}
