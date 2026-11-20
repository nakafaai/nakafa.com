import { Array as Arr, MutableHashMap, Option, Record as Rec } from "effect";
import type { GameStoreApi } from "@/components/island/store";
import type { Orbit } from "@/lib/island/camera";
import {
  panOrbit,
  turnOrbit,
  zoomOrbit,
  zoomToward,
} from "@/lib/island/camera";
import type { Point, Press, Spin } from "@/lib/island/gesture";
import {
  DRAG,
  distanceOf,
  followSpin,
  isTap,
  LONG_PRESS,
  pinchOf,
  releaseSpin,
  STILL_SPIN,
  wheelZoomOf,
} from "@/lib/island/gesture";
import { groundThrough } from "@/lib/island/matrix";

/** What the stage does with the learner's hands and keys (ADR 0047, D2 and D5). */
interface Controls {
  /** The camera as it is drawn now, and the one it eases toward. */
  readonly camera: () => { readonly goal: Orbit; readonly orbit: Orbit };
  /** Whether the learner drags the world now, for the cursor. */
  readonly drag: (dragging: boolean) => void;
  /** A mouse over a point with no button down, or none once a press starts. */
  readonly hover: (point: Option.Option<Point>) => void;
  /** Moves the camera to an orbit, at once or eased. */
  readonly move: (next: Orbit, eased?: boolean) => void;
  /** A press at a point of the screen: build there, or dig when `remove`. */
  readonly press: (point: Point, remove: boolean) => void;
  /** Hands the world the turn a drag left it with when it lifted, which fades on its own. */
  readonly spin: (spin: Spin) => void;
  /** Walks the fox a cell, right (`across`) or away from the camera (`ahead` negative). */
  readonly step: (across: number, ahead: number) => void;
}

/** How far a drag of one CSS pixel turns the world around, and tilts it, in radians. */
const TURN = { pitch: 0.006, yaw: 0.01 } as const;

/** How far a press may move, in pixels, and still count as a press. */
const STILL = 8;

/**
 * Reads the learner's pointer, wheel and keys over the canvas until
 * `release` stops it: one finger or the left button turns the world around
 * once it has moved past `DRAG`, and lets it spin on when it lifts; the right
 * button or Shift pans it, two fingers pan, pinch and twist, the wheel zooms
 * toward the pointer, a tap builds, and a press held still digs. Keys walk the
 * fox, pan, turn and zoom, and pick a hotbar slot.
 */
export function bindInput(
  canvas: HTMLCanvasElement,
  store: GameStoreApi,
  controls: Controls
) {
  const presses = MutableHashMap.empty<number, Press>();
  /** How fast the one-press turn goes, so it can spin on when the press lifts. */
  let spin: Spin = STILL_SPIN;

  /** Marks every press as used, so none of them builds when it lifts. */
  const spendPresses = () => {
    MutableHashMap.forEach(presses, (press, id) =>
      MutableHashMap.set(presses, id, { ...press, used: true })
    );
  };

  const onDown = (event: PointerEvent) => {
    canvas.setPointerCapture(event.pointerId);
    controls.hover(Option.none());
    spendPresses();
    const point = { x: event.clientX, y: event.clientY };
    const id = event.pointerId;
    spin = STILL_SPIN;
    controls.spin(STILL_SPIN);
    MutableHashMap.set(presses, id, {
      at: event.timeStamp,
      button: event.button,
      last: point,
      moved: 0,
      start: point,
      used: MutableHashMap.size(presses) > 0,
    });
  };

  /** Moves the camera as one press moved from its last point to `point`. */
  const dragTo = (press: Press, point: Point, shift: boolean, now: number) => {
    const { orbit } = controls.camera();
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
      controls.move(turnOrbit(zoomOrbit(panned, pinch.zoom), -pinch.twist));
      return;
    }
    const dx = point.x - press.last.x;
    const dy = point.y - press.last.y;
    if (press.button === 2 || shift) {
      controls.move(panOrbit(orbit, dx, dy, canvas.clientHeight));
      return;
    }
    const [yaw, pitch] = [-dx * TURN.yaw, dy * TURN.pitch];
    spin = followSpin(spin, yaw, pitch, now);
    controls.move(turnOrbit(orbit, yaw, pitch));
  };

  const onMove = (event: PointerEvent) => {
    const point = { x: event.clientX, y: event.clientY };
    const found = MutableHashMap.get(presses, event.pointerId);
    if (Option.isNone(found)) {
      if (event.pointerType === "mouse") {
        controls.hover(Option.some(point));
      }
      return;
    }
    const press = found.value;
    const moved = Math.max(press.moved, distanceOf(press.start, point));
    // A press turns the world only once it has moved past the slop of its kind of pointer.
    const slop = event.pointerType === "mouse" ? DRAG.mouse : DRAG.touch;
    if (moved < slop && MutableHashMap.size(presses) < 2) {
      MutableHashMap.set(presses, event.pointerId, { ...press, moved });
      return;
    }
    dragTo(press, point, event.shiftKey, event.timeStamp);
    if (moved >= STILL) {
      controls.drag(true);
    }
    MutableHashMap.set(presses, event.pointerId, {
      ...press,
      last: point,
      moved,
    });
  };

  const onUp = (event: PointerEvent) => {
    const found = MutableHashMap.get(presses, event.pointerId);
    MutableHashMap.remove(presses, event.pointerId);
    controls.drag(false);
    if (MutableHashMap.size(presses) === 0) {
      controls.spin(releaseSpin(spin, event.timeStamp));
      spin = STILL_SPIN;
    }
    Option.map(found, (press) => {
      if (!press.used && isTap(press.moved, event.timeStamp - press.at)) {
        controls.press(press.start, press.button === 2);
      }
    });
  };

  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    const { goal } = controls.camera();
    const rect = canvas.getBoundingClientRect();
    // The ground under the pointer stays under it while the camera comes closer or backs away.
    const ground = groundThrough(
      goal,
      rect.width / Math.max(1, rect.height),
      ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1,
      1 - ((event.clientY - rect.top) / Math.max(1, rect.height)) * 2
    );
    const factor = wheelZoomOf(event.deltaY);
    controls.move(
      Option.match(ground, {
        onNone: () => zoomOrbit(goal, factor),
        onSome: (point) => zoomToward(goal, point, factor),
      }),
      true
    );
  };

  const onKey = (event: KeyboardEvent) => {
    const state = store.getState();
    if (event.key === "Escape" && state.book) {
      state.setBook(false);
      return;
    }
    // Keys typed into the book's search, or pressed while the book is open, are not moves in the world.
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      event.target instanceof HTMLInputElement ||
      state.book
    ) {
      return;
    }
    const digit = Number.parseInt(event.key, 10);
    if (digit >= 1 && digit <= state.hotbar.length) {
      state.choose(digit - 1);
      return;
    }
    const { goal, orbit } = controls.camera();
    const height = canvas.clientHeight;
    const keys: Record<string, () => void> = {
      "+": () => controls.move(zoomOrbit(goal, 0.85), true),
      "-": () => controls.move(zoomOrbit(goal, 1.18), true),
      a: () => controls.step(-1, 0),
      arrowdown: () => controls.move(panOrbit(orbit, 0, -24, height)),
      arrowleft: () => controls.move(panOrbit(orbit, 24, 0, height)),
      arrowright: () => controls.move(panOrbit(orbit, -24, 0, height)),
      arrowup: () => controls.move(panOrbit(orbit, 0, 24, height)),
      d: () => controls.step(1, 0),
      e: () => controls.move(turnOrbit(goal, -Math.PI / 4), true),
      q: () => controls.move(turnOrbit(goal, Math.PI / 4), true),
      s: () => controls.step(0, 1),
      w: () => controls.step(0, -1),
    };
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
  return {
    /** Stops reading the learner's hands and keys. */
    release: () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
    },
    /**
     * Digs out the block under every press held still for a long press by
     * `now`, without waiting for the lift. The stage calls it each frame, and
     * a frame's time and a pointer event's share one clock.
     */
    tend: (now: number) => {
      MutableHashMap.forEach(presses, (press, id) => {
        if (press.used || press.moved >= STILL || now - press.at < LONG_PRESS) {
          return;
        }
        MutableHashMap.set(presses, id, { ...press, used: true });
        controls.press(press.start, true);
      });
    },
  };
}
