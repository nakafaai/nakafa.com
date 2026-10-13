import {
  type Bounds,
  isMoving,
  REST,
  step,
  type Toy,
} from "@repo/design-system/lib/toy/flight";
import { createToys } from "@repo/design-system/lib/toy/toys";
import { Array as Arr, MutableList, Option, Record as Rec } from "effect";

/** The page the hands play in: a window 800 tall, scrolled and calm as a test says. */
export const world = { calm: false, scrollY: 0 };

/** A frame of the clock, in milliseconds, and the same frame in seconds as the physics counts it. */
export const FRAME = 16;
export const FRAME_SECONDS = FRAME / 1000;

/** The fastest a toy is thrown, in pixels per second. */
export const TOP_SPEED = 2200;

/**
 * How far the toy of `toyIn` can move from the place it lies at before it
 * meets a wall of `room`.
 */
export const ROOM_WALLS = { maxX: 544, maxY: 394, minX: -200, minY: -150 };

/** The walls of a pen for toys that fly without a page, and a toy at rest in the middle of it. */
export const PEN: Bounds = { maxX: 300, maxY: 250, minX: -100, minY: -50 };
export const INSIDE = Option.some(PEN);
export const MIDDLE: Toy = { ...REST, x: 100, y: 100 };

/** Lets a toy fly for a while and gives every frame it passed through. */
export function fly(toy: Toy, bounds: Option.Option<Bounds>, frames = 600) {
  return Arr.scan(
    Arr.makeBy(frames, () => FRAME_SECONDS),
    toy,
    (state, dt) => (isMoving(state) ? step(state, dt, bounds) : state)
  );
}

/** Whether a toy is inside the pen. */
export function within(toy: Toy) {
  return (
    toy.x >= PEN.minX &&
    toy.x <= PEN.maxX &&
    toy.y >= PEN.minY &&
    toy.y <= PEN.maxY
  );
}

/** Sets properties on an element that the test page cannot measure for itself. */
export function define(el: Element, values: Record<string, unknown>) {
  Object.defineProperties(
    el,
    Rec.map(values, (value) => ({ configurable: true, value }))
  );
}

/** A root around a parent of 800 by 600. */
export function room() {
  document.body.replaceChildren();
  const root = document.createElement("div");
  const parent = document.createElement("div");
  root.append(parent);
  document.body.append(root);
  define(parent, { clientHeight: 600, clientWidth: 800 });
  return { parent, root };
}

/** A toy of 56 at (200, 150) in `parent`. */
export function toyIn(parent: HTMLElement) {
  const toy = document.createElement("div");
  parent.append(toy);
  define(toy, {
    offsetHeight: 56,
    offsetLeft: 200,
    offsetParent: parent,
    offsetTop: 150,
    offsetWidth: 56,
    setPointerCapture: vi.fn(),
  });
  return toy;
}

/** One reading of pointer number 1 (or another), as the browser tells it. */
export function point(
  target: EventTarget,
  type: string,
  x: number,
  y: number,
  init: PointerEventInit = {}
) {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      button: 0,
      clientX: x,
      clientY: y,
      pointerId: 1,
      ...init,
    })
  );
}

/** A click on an element, which says whether anything stopped it. */
export function click(target: EventTarget) {
  const event = new MouseEvent("click", { bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

const POSE =
  /translate3d\((-?[0-9.]+)px,(-?[0-9.]+)px,0\) rotate\((-?[0-9.]+)deg\)/;

/** Where the toy is, as the browser was told to draw it: its offset from the place it lies at. */
export function offsetOf(toy: HTMLElement) {
  const found = POSE.exec(toy.style.transform);
  return found ? { x: Number(found[1]), y: Number(found[2]) } : { x: 0, y: 0 };
}

/** How far the toy leans, in degrees, as the browser was told to draw it. The toy must have been drawn. */
export function tiltOf(toy: HTMLElement) {
  const found = Option.getOrThrow(
    Option.fromNullishOr(POSE.exec(toy.style.transform))
  );
  return Number(found[3]);
}

/** Lets the browser draw frames for a time in milliseconds. */
export function wait(ms: number) {
  vi.advanceTimersByTime(ms);
}

/** Where the toy was at every frame of the next `ms` milliseconds. */
export function flight(toy: HTMLElement, ms: number) {
  return Arr.makeBy(Math.ceil(ms / FRAME), () => {
    wait(FRAME);
    return offsetOf(toy);
  });
}

/** A clock that only the test moves, and a window that says what the test wants it to. */
export function stagePage() {
  world.calm = false;
  world.scrollY = 0;
  vi.useFakeTimers({
    now: 0,
    toFake: ["performance", "requestAnimationFrame", "cancelAnimationFrame"],
  });
  Object.defineProperties(window, {
    innerHeight: { configurable: true, value: 800 },
    matchMedia: {
      configurable: true,
      value: () => ({ matches: world.calm }),
    },
    scrollBy: {
      configurable: true,
      value: ({ top }: { top: number }) => {
        world.scrollY += top;
        window.dispatchEvent(new Event("scroll"));
      },
    },
    scrollX: { configurable: true, value: 0 },
    scrollY: { configurable: true, get: () => world.scrollY },
  });
}

let stops: (() => void)[] = [];

/** Starts the toys on a root. `leave` stops them at the end of the test. */
export function begin(root: HTMLElement) {
  const toys = createToys();
  stops = Arr.append(stops, toys.attach(root));
  return toys;
}

/** A room with the toys started on its root, and one toy in it. */
export function play(
  heard: Parameters<ReturnType<typeof createToys>["add"]>[1] = {}
) {
  const { parent, root } = room();
  const toys = begin(root);
  const toy = toyIn(parent);
  const remove = toys.add(toy, heard);
  return { parent, remove, root, toy, toys };
}

/** Puts the page back as the test found it: the toys stopped, the doubles and the fake clock taken away. */
export function leave() {
  Arr.forEach(stops, (stop) => stop());
  stops = [];
  vi.restoreAllMocks();
  vi.useRealTimers();
}

/** Reactions that write down what a toy tells its page. */
export function listening() {
  const told = MutableList.make<string>();
  return {
    heard: {
      drop: ({ x, y }: { x: number; y: number }) =>
        MutableList.append(told, `drop ${x},${y}`),
      grab: () => MutableList.append(told, "grab"),
      release: () => MutableList.append(told, "release"),
    },
    told,
  };
}

/**
 * Takes a toy in the middle of the window and moves the hand by (dx, dy) a
 * frame, three frames, then lets go at once. The hand stops short of every
 * wall, so the toy meets it in flight.
 */
export function throwToy(toy: HTMLElement, dx: number, dy: number) {
  point(toy, "pointerdown", 400, 300);
  Arr.forEach(Arr.range(1, 3), (frame) => {
    wait(FRAME);
    point(toy, "pointermove", 400 + dx * frame, 300 + dy * frame);
  });
  point(toy, "pointerup", 400 + dx * 3, 300 + dy * 3);
}

/** Takes a toy and moves it by `dx`, then lets go after a rest, so that it is put down and not thrown. */
export function put(toy: HTMLElement, dx: number) {
  point(toy, "pointerdown", 400, 300);
  wait(FRAME);
  point(toy, "pointermove", 400 + dx, 300);
  wait(96);
  point(toy, "pointerup", 400 + dx, 300);
}
