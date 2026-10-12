import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { gaze, LOOK_ATTRIBUTE, watch } from "@repo/design-system/lib/watch";
import { leave, stagePage, world } from "@repo/design-system/test/toy";
import { Array as Arr, MutableList } from "effect";

const SVG = "http://www.w3.org/2000/svg";
let stopped: (() => void)[] = [];
let observers: ObserverStub[] = [];

/** An observer that tells nothing by itself: the tests say when the element comes near the screen. */
class ObserverStub {
  callback: (entries: { isIntersecting: boolean }[]) => void;
  disconnected = false;

  constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
    this.callback = callback;
    observers = Arr.append(observers, this);
  }

  observe() {
    // The stub watches nothing: the tests call the callback.
  }

  disconnect() {
    this.disconnected = true;
  }
}

/** Says that the watched element is near the screen, or far from it. */
function come(near: boolean) {
  Arr.forEach(observers, (observer) =>
    observer.callback([{ isIntersecting: near }])
  );
}

/** Starts watching, and stops at the end of the test, so no listener outlives it. */
function begin(root: HTMLElement) {
  const stop = watch(root);
  stopped = Arr.append(stopped, stop);
  return stop;
}

function move(x: number, y: number) {
  window.dispatchEvent(
    new PointerEvent("pointermove", { clientX: x, clientY: y })
  );
}

beforeEach(() => {
  observers = [];
  stagePage();
  vi.stubGlobal("IntersectionObserver", ObserverStub);
});

afterEach(() => {
  Arr.forEach(stopped, (stop) => stop());
  stopped = [];
  vi.unstubAllGlobals();
  leave();
});

describe("where eyes look", () => {
  const face = { height: 40, left: 80, top: 180, width: 40 };

  it("turns toward a pointer by at most three units and a fifth", () => {
    // The middle of the face is at (100, 200).
    expect(gaze({ x: 1000, y: 200 }, face)).toEqual({ x: 3.2, y: 0 });
    expect(gaze({ x: -900, y: 200 }, face)).toEqual({ x: -3.2, y: 0 });
  });

  it("looks up and down less than sideways", () => {
    const below = gaze({ x: 100, y: 2000 }, face);
    expect(below.x).toBe(0);
    expect(below.y).toBeCloseTo(3.2 * 0.8, 9);
  });

  it("turns less the nearer the pointer is, in proportion to 160 pixels", () => {
    const near = gaze({ x: 180, y: 200 }, face);
    expect(near.x).toBeCloseTo(3.2 * 0.5, 9);
    const diagonal = gaze(
      { x: 100 + 56.568_542_494_9, y: 200 + 56.568_542_494_9 },
      face
    );
    expect(diagonal.x).toBeCloseTo(3.2 * 0.5 * Math.SQRT1_2, 6);
    expect(diagonal.y).toBeCloseTo(3.2 * 0.5 * Math.SQRT1_2 * 0.8, 6);
  });

  it("does not turn toward a pointer on the middle of the face", () => {
    expect(gaze({ x: 100, y: 200 }, face)).toEqual({ x: 0, y: 0 });
  });
});

/** An element that holds faces: each has a box and writes down when it is measured and written. */
function faces(log: ReturnType<typeof MutableList.make<string>>) {
  const root = document.createElement("div");
  const face = (name: string, width: number, left: number) => {
    const svg = document.createElementNS(SVG, "svg");
    svg.setAttribute(LOOK_ATTRIBUTE, "");
    svg.getBoundingClientRect = () => {
      MutableList.append(log, `read ${name}`);
      return new DOMRect(left, 0, width, 100);
    };
    const set = svg.style.setProperty.bind(svg.style);
    svg.style.setProperty = (property, value) => {
      MutableList.append(log, `write ${name}`);
      set(property, value);
    };
    root.append(svg);
    return svg;
  };
  return {
    first: face("first", 100, 0),
    hidden: face("hidden", 0, 0),
    root,
    second: face("second", 100, 300),
  };
}

describe("eyes that follow the pointer", () => {
  it("turn the faces together, measuring all of them before turning any, in one frame", () => {
    const log = MutableList.make<string>();
    const { first, hidden, root, second } = faces(log);
    // A marked element that is not a picture has no eyes to turn.
    const other = document.createElement("div");
    other.setAttribute(LOOK_ATTRIBUTE, "");
    root.append(other);
    begin(root);
    come(true);
    move(10, 10);
    move(1000, 50);
    expect(MutableList.toArray(log)).toEqual([]);
    vi.advanceTimersByTime(16);
    expect(MutableList.takeAll(log)).toEqual([
      "read first",
      "read hidden",
      "read second",
      "write first",
      "write first",
      "write second",
      "write second",
    ]);
    // Only the last place of the pointer counts.
    expect(first.style.getPropertyValue("--look-x")).toBe("3.20");
    expect(first.style.getPropertyValue("--look-y")).toBe("0.00");
    expect(second.style.getPropertyValue("--look-x")).toBe("3.20");
    expect(hidden.style.getPropertyValue("--look-x")).toBe("");
    expect(other.style.getPropertyValue("--look-x")).toBe("");
  });

  it("ask for one frame however many times the pointer moves", () => {
    const { root } = faces(MutableList.make<string>());
    begin(root);
    come(true);
    Arr.forEach(Arr.range(1, 20), (x) => move(x, x));
    expect(vi.getTimerCount()).toBe(1);
  });

  it("look at the faces that are there when the pointer moves", () => {
    const { first, root } = faces(MutableList.make<string>());
    begin(root);
    come(true);
    move(1000, 50);
    first.remove();
    vi.advanceTimersByTime(16);
    expect(first.style.getPropertyValue("--look-x")).toBe("");
  });

  it("do not follow a person who asks for less motion, and ask for no frame", () => {
    world.calm = true;
    const { first, root } = faces(MutableList.make<string>());
    begin(root);
    come(true);
    move(1000, 50);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(16);
    expect(first.style.getPropertyValue("--look-x")).toBe("");
  });

  it("hold where they are once a person asks for less motion with the page open, and follow again when the person no longer asks", () => {
    const { first, root } = faces(MutableList.make<string>());
    begin(root);
    come(true);
    move(1000, 50);
    vi.advanceTimersByTime(16);
    expect(first.style.getPropertyValue("--look-x")).toBe("3.20");
    world.calm = true;
    move(-900, 50);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(16);
    expect(first.style.getPropertyValue("--look-x")).toBe("3.20");
    world.calm = false;
    move(-900, 50);
    vi.advanceTimersByTime(16);
    expect(first.style.getPropertyValue("--look-x")).toBe("-3.20");
  });

  it("stop when they are stopped, and drop the frame they asked for", () => {
    const { first, root } = faces(MutableList.make<string>());
    const stop = begin(root);
    come(true);
    move(1000, 50);
    stop();
    expect(Arr.every(observers, (observer) => observer.disconnected)).toBe(
      true
    );
    vi.advanceTimersByTime(16);
    expect(first.style.getPropertyValue("--look-x")).toBe("");
    move(1000, 50);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("the listener of the eyes", () => {
  it("does not exist while the faces are far from the screen, and exists once they come near", () => {
    const { first, root } = faces(MutableList.make<string>());
    const listening = vi.spyOn(window, "addEventListener");
    begin(root);
    move(1000, 50);
    vi.advanceTimersByTime(16);
    expect(listening).not.toHaveBeenCalled();
    expect(first.style.getPropertyValue("--look-x")).toBe("");
    come(true);
    expect(listening).toHaveBeenCalledTimes(1);
    move(1000, 50);
    vi.advanceTimersByTime(16);
    expect(first.style.getPropertyValue("--look-x")).toBe("3.20");
  });

  it("listens once however often the faces come near, goes when they leave with the frame it asked for, and comes back with them", () => {
    const { first, root } = faces(MutableList.make<string>());
    const listening = vi.spyOn(window, "addEventListener");
    begin(root);
    come(true);
    come(true);
    expect(listening).toHaveBeenCalledTimes(1);
    move(1000, 50);
    come(false);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(16);
    expect(first.style.getPropertyValue("--look-x")).toBe("");
    move(1000, 50);
    expect(vi.getTimerCount()).toBe(0);
    come(false);
    come(true);
    expect(listening).toHaveBeenCalledTimes(2);
  });
});
