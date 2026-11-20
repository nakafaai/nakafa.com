import { MutableHashMap, Option, Record as Rec, Schema } from "effect";
import type { GameStoreApi } from "@/components/island/store";
import { Point } from "@/lib/island/gesture";

/** What the stage does with the learner's hands and keys (ADR 0050, W7). */
interface Controls {
  /** A brush set down at a point, `first` when its stroke begins there. */
  readonly dab: (point: Point, first: boolean) => void;
  /** Whether the learner drags the world now, for the cursor. */
  readonly drag: (dragging: boolean) => void;
  /** The stroke of a brush ended. */
  readonly endStroke: () => void;
  /** Lets the camera follow the fox again. */
  readonly follow: () => void;
  /** The way the keys send the fox: right (`across`), away from the camera (`ahead`), and whether it runs. */
  readonly hold: (across: number, ahead: number, run: boolean) => void;
  /** A pointer over a point with no button down, or none once it leaves. */
  readonly hover: (point: Option.Option<Point>) => void;
  /** The fox jumps. */
  readonly jump: () => void;
  /** Moves the ground from one point of the screen to another, in `seconds`. */
  readonly pan: (from: Point, to: Point, seconds: number) => void;
  /** A press at a point of the screen. */
  readonly press: (point: Point) => void;
  /** Stops what a drag left the camera moving and turning with. */
  readonly rest: () => void;
  /** Takes the selected thing away. */
  readonly take: () => void;
  /** Turns the camera by `yaw` and tilts it by `tilt` radians in `seconds`; no time is a step. */
  readonly turn: (yaw: number, tilt: number, seconds: number) => void;
  /** Turns the thing picked up, or the hand, a quarter. */
  readonly twist: () => void;
  /** Moves the camera closer (a factor under 1) or farther, toward a point of the screen. */
  readonly zoom: (factor: number, toward: Point) => void;
}

/** How far a press may move, in pixels, and still be a tap, and how long it may last, in milliseconds. */
const TAP = { held: 500, slop: 7 } as const;

/** How far a drag of one pixel turns and tilts the camera, in radians. */
const TURN = { tilt: 0.004, yaw: -0.007 } as const;

/**
 * One finger or button on the canvas: which button, when it last moved and
 * when it came down, in milliseconds, whether it has left the place of a tap,
 * whether it paints a stroke, where it came down and where it is now.
 */
const Touch = Schema.Struct({
  button: Schema.Int,
  last: Schema.Finite,
  moved: Schema.Boolean,
  paints: Schema.Boolean,
  since: Schema.Finite,
  start: Point,
  x: Schema.Finite,
  y: Schema.Finite,
});
type Touch = typeof Touch.Type;

/**
 * Reads the learner's pointer, wheel and keys over the canvas until `release`
 * stops it: a tap presses, a drag moves the ground under the finger and
 * leaves it gliding, the right button or Shift turns and tilts, two fingers
 * pan, pinch and twist, the wheel zooms toward the pointer, and in brush mode
 * a drag is a stroke. Keys walk the fox, turn the camera, undo and redo, and
 * pick the hand.
 */
export function bindInput(
  canvas: HTMLCanvasElement,
  store: GameStoreApi,
  controls: Controls
) {
  const touches = MutableHashMap.empty<number, Touch>();
  let pinch = Option.none<{ angle: number; middle: Point; spread: number }>();
  const held = MutableHashMap.empty<string, true>();

  /** The two fingers' spread, angle and middle. */
  const pinchOf = () => {
    const [first, second] = [...MutableHashMap.values(touches)];
    return {
      angle: Math.atan2(second.y - first.y, second.x - first.x),
      middle: { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 },
      spread: Math.hypot(first.x - second.x, first.y - second.y),
    };
  };

  /** Whether the learner shapes their own land now. */
  const brushes = () =>
    store.getState().mode === "brush" && store.getState().host === null;

  const onDown = (event: PointerEvent) => {
    canvas.setPointerCapture(event.pointerId);
    const point = { x: event.clientX, y: event.clientY };
    const paints =
      brushes() && event.button === 0 && MutableHashMap.size(touches) === 0;
    MutableHashMap.set(touches, event.pointerId, {
      button: event.button,
      last: event.timeStamp,
      moved: false,
      paints,
      since: event.timeStamp,
      start: point,
      ...point,
    });
    controls.rest();
    controls.hover(Option.none());
    if (MutableHashMap.size(touches) === 2) {
      pinch = Option.some(pinchOf());
      MutableHashMap.forEach(touches, (touch, id) =>
        MutableHashMap.set(touches, id, {
          ...touch,
          moved: true,
          paints: false,
        })
      );
      controls.endStroke();
      return;
    }
    if (paints) {
      controls.dab(point, true);
    }
  };

  /** Moves the camera as two fingers moved. */
  const onPinch = (
    before: { angle: number; middle: Point; spread: number },
    seconds: number
  ) => {
    const now = pinchOf();
    controls.zoom(before.spread / Math.max(20, now.spread), now.middle);
    controls.turn(
      -Math.atan2(
        Math.sin(now.angle - before.angle),
        Math.cos(now.angle - before.angle)
      ),
      0,
      0
    );
    controls.pan(before.middle, now.middle, seconds);
    pinch = Option.some(now);
  };

  const onMove = (event: PointerEvent) => {
    const point = { x: event.clientX, y: event.clientY };
    const found = MutableHashMap.get(touches, event.pointerId);
    if (Option.isNone(found)) {
      if (event.pointerType === "mouse") {
        controls.hover(Option.some(point));
      }
      return;
    }
    const touch = found.value;
    const seconds = Math.max(0.001, (event.timeStamp - touch.last) / 1000);
    const moved =
      touch.moved ||
      Math.hypot(point.x - touch.start.x, point.y - touch.start.y) > TAP.slop;
    MutableHashMap.set(touches, event.pointerId, {
      ...touch,
      ...point,
      last: event.timeStamp,
      moved,
    });
    if (Option.isSome(pinch) && MutableHashMap.size(touches) === 2) {
      onPinch(pinch.value, seconds);
      return;
    }
    if (touch.paints) {
      controls.hover(Option.some(point));
      controls.dab(point, false);
      return;
    }
    if (!moved) {
      return;
    }
    controls.drag(true);
    if (touch.button === 2 || event.shiftKey) {
      controls.turn(
        (point.x - touch.x) * TURN.yaw,
        (point.y - touch.y) * TURN.tilt,
        seconds
      );
      return;
    }
    controls.pan({ x: touch.x, y: touch.y }, point, seconds);
  };

  const onUp = (event: PointerEvent) => {
    const found = MutableHashMap.get(touches, event.pointerId);
    MutableHashMap.remove(touches, event.pointerId);
    controls.drag(false);
    if (MutableHashMap.size(touches) < 2) {
      pinch = Option.none();
    }
    Option.map(found, (touch) => {
      if (touch.paints) {
        controls.endStroke();
        return;
      }
      // A finger that rested before it lifted leaves the camera still.
      if (event.timeStamp - touch.last > 90) {
        controls.rest();
      }
      const tapped =
        event.type === "pointerup" &&
        !touch.moved &&
        touch.button === 0 &&
        event.timeStamp - touch.since < TAP.held;
      if (tapped) {
        controls.press(touch.start);
      }
    });
    if (event.pointerType !== "mouse") {
      controls.hover(Option.none());
    }
  };

  const onLeave = (event: PointerEvent) => {
    if (event.pointerType === "mouse") {
      controls.hover(Option.none());
    }
  };

  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    if (event.shiftKey) {
      controls.turn((event.deltaY + event.deltaX) * 0.002, 0, 0);
      return;
    }
    const delta = Math.min(120, Math.max(-120, event.deltaY));
    controls.zoom(Math.exp(delta * (event.ctrlKey ? 0.012 : 0.0016)), {
      x: event.clientX,
      y: event.clientY,
    });
  };

  /** Sends the fox the way the held keys point. */
  const steer = () => {
    const down = (key: string) => MutableHashMap.has(held, key);
    const ahead =
      Number(down("w") || down("arrowup")) -
      Number(down("s") || down("arrowdown"));
    const across =
      Number(down("d") || down("arrowright")) -
      Number(down("a") || down("arrowleft"));
    controls.hold(across, ahead, down("shift"));
    if (ahead !== 0 || across !== 0) {
      controls.follow();
    }
  };

  /** The keys that work with Control or Command held: undo, and redo with Shift. Whether the key was one of them or any other shortcut of the browser's. */
  const shortcut = (event: KeyboardEvent, key: string) => {
    if (!(event.ctrlKey || event.metaKey)) {
      return false;
    }
    if (key === "z") {
      event.preventDefault();
      const state = store.getState();
      (event.shiftKey ? state.redo : state.undo)();
    }
    return true;
  };

  /** The keys that walk the fox while they are held. Whether the key was one of them. */
  const walkKey = (event: KeyboardEvent, key: string) => {
    if (!("wasd".includes(key) || key.startsWith("arrow") || key === "shift")) {
      return false;
    }
    MutableHashMap.set(held, key, true);
    if (key.startsWith("arrow")) {
      event.preventDefault();
    }
    steer();
    return true;
  };

  /** What each other key does in the world. */
  const commands = (): Record<string, () => void> => {
    const state = store.getState();
    const owns = state.host === null;
    return {
      " ": controls.jump,
      "1": () => state.setMode("explore"),
      "2": () => owns && state.setMode("build"),
      "3": () => owns && state.setMode("brush"),
      backspace: controls.take,
      c: controls.follow,
      delete: controls.take,
      e: () => controls.turn(-Math.PI / 4, 0, 0),
      m: () => state.setSheet("map"),
      q: () => controls.turn(Math.PI / 4, 0, 0),
      r: controls.twist,
    };
  };

  const onKey = (event: KeyboardEvent) => {
    const state = store.getState();
    const key = event.key.toLowerCase();
    if (
      event.target instanceof HTMLInputElement ||
      event.altKey ||
      shortcut(event, key)
    ) {
      return;
    }
    if (key === "escape") {
      (state.sheet === null
        ? () => state.setMode("explore")
        : () => state.setSheet(null))();
      return;
    }
    // Keys pressed while a sheet is open are not moves in the world.
    if (state.sheet !== null || walkKey(event, key)) {
      return;
    }
    Option.map(Rec.get(commands(), key), (handler) => {
      event.preventDefault();
      handler();
    });
  };

  const onKeyUp = (event: KeyboardEvent) => {
    MutableHashMap.remove(held, event.key.toLowerCase());
    steer();
  };

  const onBlur = () => {
    MutableHashMap.clear(held);
    steer();
  };

  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("pointerleave", onLeave);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  return {
    /** Stops reading the learner's hands and keys. */
    release: () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    },
  };
}
