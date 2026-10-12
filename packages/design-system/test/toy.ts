import { Array as Arr, Record as Rec } from "effect";

/** The page the hands play in: a window 800 tall, scrolled and calm as a test says. */
export const world = { calm: false, scrollY: 0 };

/** A frame of the clock, in milliseconds. */
export const FRAME = 16;

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
