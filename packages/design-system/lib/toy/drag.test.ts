import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { TOY_ATTRIBUTE } from "@repo/design-system/lib/toy/dom";
import { createToys } from "@repo/design-system/lib/toy/drag";
import {
  click,
  define,
  FRAME,
  flight,
  offsetOf,
  point,
  room,
  stagePage,
  toyIn,
  wait,
  world,
} from "@repo/design-system/test/toy";
import { Array as Arr, MutableList, Predicate, Result } from "effect";

let stopped: (() => void)[] = [];

/**
 * A toy of 56 at (200, 150) in a parent of 800 by 600 can move this far from
 * the place it lies at before it meets a wall.
 */
const WALLS = { maxX: 544, maxY: 394, minX: -200, minY: -150 };
/** The fastest a toy is thrown, in pixels per second. */
const TOP_SPEED = 2200;

/** A room with the toys started on its root, and one toy in it. */
function play(heard: Parameters<ReturnType<typeof createToys>["add"]>[1] = {}) {
  const { parent, root } = room();
  const toys = createToys();
  stopped = Arr.append(stopped, toys.attach(root));
  const toy = toyIn(parent);
  const remove = toys.add(toy, heard);
  return { parent, remove, root, toy, toys };
}

/** Reactions that write down what a toy tells its page. */
function listening() {
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
function throwToy(toy: HTMLElement, dx: number, dy: number) {
  point(toy, "pointerdown", 400, 300);
  Arr.forEach(Arr.range(1, 3), (frame) => {
    wait(FRAME);
    point(toy, "pointermove", 400 + dx * frame, 300 + dy * frame);
  });
  point(toy, "pointerup", 400 + dx * 3, 300 + dy * 3);
}

/** Takes a toy and moves it by `dx`, then lets go after a rest, so that it is put down and not thrown. */
function put(toy: HTMLElement, dx: number) {
  point(toy, "pointerdown", 400, 300);
  wait(FRAME);
  point(toy, "pointermove", 400 + dx, 300);
  wait(96);
  point(toy, "pointerup", 400 + dx, 300);
}

function inside({ x, y }: { x: number; y: number }) {
  return (
    x >= WALLS.minX && x <= WALLS.maxX && y >= WALLS.minY && y <= WALLS.maxY
  );
}

function atWall({ x, y }: { x: number; y: number }) {
  return (
    Arr.contains([WALLS.minX, WALLS.maxX], x) ||
    Arr.contains([WALLS.minY, WALLS.maxY], y)
  );
}

beforeEach(stagePage);

afterEach(() => {
  Arr.forEach(stopped, (stop) => stop());
  stopped = [];
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("a toy in a hand", () => {
  it("follows the hand from the point where it was taken, and never jumps under the pointer", () => {
    const { toy } = play();
    point(toy, "pointerdown", 230, 170, { pointerId: 7 });
    expect(toy.setPointerCapture).toHaveBeenCalledWith(7);
    wait(FRAME);
    point(toy, "pointermove", 330, 160, { pointerId: 7 });
    expect(offsetOf(toy)).toEqual({ x: 100, y: -10 });
  });

  it("belongs to one pointer: a second finger does not take it over, nor take another toy", () => {
    const { parent, toy, toys } = play();
    const other = toyIn(parent);
    toys.add(other, {});
    point(toy, "pointerdown", 400, 300);
    wait(FRAME);
    point(toy, "pointermove", 440, 340);
    point(toy, "pointermove", 700, 500, { pointerId: 2 });
    point(toy, "pointerup", 700, 500, { pointerId: 2 });
    point(toy, "pointercancel", 700, 500, { pointerId: 2 });
    point(other, "pointerdown", 700, 500, { pointerId: 2 });
    expect(offsetOf(toy)).toEqual({ x: 40, y: 40 });
    expect(toy.dataset.held).toBe("true");
    expect(other.dataset.held).toBeUndefined();
    point(toy, "pointerup", 440, 340);
    expect(toy.dataset.held).toBe("false");
  });

  it("answers only to the main button", () => {
    const { toy } = play();
    point(toy, "pointerdown", 400, 300, { button: 2 });
    expect(toy.dataset.held).toBeUndefined();
  });

  it("lifts each toy it takes above the last", () => {
    const { parent, toy, toys } = play();
    const other = toyIn(parent);
    toys.add(other, {});
    Arr.forEach([toy, other, toy], (taken) => {
      point(taken, "pointerdown", 400, 300);
      point(taken, "pointerup", 400, 300);
    });
    expect([toy.style.zIndex, other.style.zIndex]).toEqual(["13", "12"]);
  });

  it("takes nothing that is not a toy, and leaves every toy at its place", () => {
    const { parent, toy } = play();
    point(parent, "pointerdown", 400, 300);
    wait(FRAME);
    point(parent, "pointermove", 480, 300);
    expect(parent.dataset.held).toBeUndefined();
    expect(toy.dataset.held).toBeUndefined();
    expect(offsetOf(toy)).toEqual({ x: 0, y: 0 });
  });

  it("keeps each toy where it was left: moving one does not move another", () => {
    const { parent, toy, toys } = play();
    const other = toyIn(parent);
    toys.add(other, {});
    put(toy, 100);
    put(other, 20);
    expect(offsetOf(toy)).toEqual({ x: 100, y: 0 });
    expect(offsetOf(other)).toEqual({ x: 20, y: 0 });
  });

  it("stops at the walls of its box, however far the hand goes", () => {
    const { toy } = play();
    point(toy, "pointerdown", 400, 300);
    wait(FRAME);
    point(toy, "pointermove", 3400, -2700);
    expect(offsetOf(toy)).toEqual({ x: WALLS.maxX, y: WALLS.minY });
    point(toy, "pointermove", -2600, 3300);
    expect(offsetOf(toy)).toEqual({ x: WALLS.minX, y: WALLS.maxY });
  });

  it("goes where the hand takes it when it has no parent to measure", () => {
    const { toy } = play();
    define(toy, { offsetParent: null });
    point(toy, "pointerdown", 400, 300);
    wait(FRAME);
    point(toy, "pointermove", 3400, -2700);
    expect(offsetOf(toy)).toEqual({ x: 3000, y: -3000 });
  });

  it("keeps its place under the hand when the page scrolls", () => {
    const { toy } = play();
    point(toy, "pointerdown", 400, 300);
    wait(FRAME);
    point(toy, "pointermove", 440, 330);
    world.scrollY = 120;
    window.dispatchEvent(new Event("scroll"));
    expect(offsetOf(toy)).toEqual({ x: 40, y: 150 });
  });

  it("does not move a press that never moved when the page scrolls", () => {
    const { toy } = play();
    point(toy, "pointerdown", 400, 300);
    world.scrollY = 90;
    window.dispatchEvent(new Event("scroll"));
    point(toy, "pointerup", 400, 300);
    expect(offsetOf(toy)).toEqual({ x: 0, y: 0 });
  });

  it.each([
    { edge: "bottom", y: 790, sign: 1 },
    { edge: "top", y: 10, sign: -1 },
  ])(
    "pulls the page along near the $edge of the window, no faster than 900 pixels a second",
    ({ sign, y }) => {
      world.scrollY = 1000;
      const { toy } = play();
      point(toy, "pointerdown", 400, 300);
      wait(FRAME);
      point(toy, "pointermove", 400, y);
      wait(1000);
      const pulled = (world.scrollY - 1000) * sign;
      expect(pulled).toBeGreaterThan(500);
      expect(pulled).toBeLessThanOrEqual(900);
    }
  );

  it("does not pull the page along in the middle of the window", () => {
    const { toy } = play();
    point(toy, "pointerdown", 400, 300);
    wait(FRAME);
    point(toy, "pointermove", 400, 400);
    wait(1000);
    expect(world.scrollY).toBe(0);
  });
});

describe("a toy let go", () => {
  it.each([
    { name: "right wall", dx: 40, dy: 0 },
    { name: "left wall", dx: -40, dy: 0 },
    { name: "bottom wall", dx: 0, dy: 40 },
    { name: "top wall", dx: 0, dy: -40 },
    { name: "bottom right corner", dx: 30, dy: 30 },
    { name: "top left corner", dx: -30, dy: -30 },
  ])(
    "never leaves its box when thrown at the $name, and comes to rest",
    ({ dx, dy }) => {
      const { toy } = play();
      throwToy(toy, dx, dy);
      const offsets = flight(toy, 5000);
      expect(Arr.every(offsets, inside)).toBe(true);
      expect(Arr.some(offsets, atWall)).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    }
  );

  it("never passes the top speed, however fast the hand was", () => {
    const { toy } = play();
    point(toy, "pointerdown", 100, 300);
    wait(FRAME);
    // Three hundred pixels in one frame is 18 750 pixels a second.
    point(toy, "pointermove", 400, 300);
    point(toy, "pointerup", 400, 300);
    const offsets = Arr.prepend(flight(toy, 1000), { x: 300, y: 0 });
    const steps = Arr.map(
      Arr.zip(offsets, Arr.drop(offsets, 1)),
      ([from, to]) => Math.abs(to.x - from.x)
    );
    expect(Arr.some(steps, (step) => step > 0)).toBe(true);
    expect(Arr.every(steps, (step) => step <= (TOP_SPEED * FRAME) / 1000)).toBe(
      true
    );
  });

  it("throws nothing when the hand rested for more than 80 milliseconds before letting go", () => {
    const { toy } = play();
    put(toy, 60);
    const dropped = offsetOf(toy);
    expect(
      Arr.every(flight(toy, 1000), (offset) => offset.x === dropped.x)
    ).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stands still for a person who asked for less motion: it stays where the hand left it", () => {
    world.calm = true;
    const { toy } = play();
    throwToy(toy, 40, 0);
    const dropped = offsetOf(toy);
    expect(
      Arr.every(flight(toy, 1000), (offset) => offset.x === dropped.x)
    ).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("is stopped by a hand that takes it while it flies", () => {
    const { toy } = play();
    throwToy(toy, 20, 0);
    wait(160);
    point(toy, "pointerdown", 400, 300);
    point(toy, "pointerup", 400, 300);
    const stoppedAt = offsetOf(toy);
    wait(800);
    expect(offsetOf(toy)).toEqual(stoppedAt);
  });

  it("is let go without a throw and without a drop when the pointer is cancelled", () => {
    const { heard, told } = listening();
    const { toy } = play(heard);
    point(toy, "pointerdown", 300, 200);
    wait(FRAME);
    point(toy, "pointermove", 360, 200);
    const held = offsetOf(toy);
    point(toy, "pointercancel", 360, 200);
    wait(480);
    expect(offsetOf(toy)).toEqual(held);
    expect(MutableList.takeAll(told)).toEqual(["grab", "release"]);
  });

  it("is let go when the pointer capture is lost", () => {
    const { toy } = play();
    point(toy, "pointerdown", 400, 300);
    toy.dispatchEvent(
      new PointerEvent("lostpointercapture", { bubbles: true, pointerId: 1 })
    );
    expect(toy.dataset.held).toBe("false");
  });

  it("is let go when the toys are stopped, and stopping again needs no care", () => {
    const { parent, root } = room();
    const toys = createToys();
    const stop = toys.attach(root);
    const toy = toyIn(parent);
    toys.add(toy, {});
    point(toy, "pointerdown", 400, 300);
    wait(FRAME);
    point(toy, "pointermove", 460, 300);
    stop();
    expect(toy.dataset.held).toBe("false");
    expect(vi.getTimerCount()).toBe(0);
    point(toy, "pointermove", 600, 300);
    expect(offsetOf(toy)).toEqual({ x: 60, y: 0 });
    expect(() => stop()).not.toThrow();
  });
});

describe("a press", () => {
  it("is still a click when the hand never moved", () => {
    const { toy } = play();
    point(toy, "pointerdown", 400, 300);
    point(toy, "pointermove", 402, 302);
    point(toy, "pointerup", 402, 302);
    expect(click(toy).defaultPrevented).toBe(false);
  });

  it("is not a click when the hand dragged the toy, and the next press is a click again", () => {
    const { parent, toy } = play();
    put(toy, 60);
    expect(click(parent).defaultPrevented).toBe(false);
    expect(click(toy).defaultPrevented).toBe(true);
    point(toy, "pointerdown", 400, 300);
    point(toy, "pointerup", 400, 300);
    expect(click(toy).defaultPrevented).toBe(false);
  });

  it("swallows only the click that follows a drag: the next press ends it, even when no click came", () => {
    const { parent, toy } = play();
    put(toy, 60);
    point(parent, "pointerdown", 10, 10);
    expect(click(toy).defaultPrevented).toBe(false);
  });
});

describe("a toy that tells its page", () => {
  it("tells when it is taken, let go, and, after a drag, where the hand dropped it", () => {
    const { heard, told } = listening();
    const { toy } = play(heard);
    point(toy, "pointerdown", 400, 300);
    wait(FRAME);
    point(toy, "pointermove", 460, 300);
    point(toy, "pointerup", 470, 310);
    expect(MutableList.takeAll(told)).toEqual([
      "grab",
      "release",
      "drop 470,310",
    ]);
  });

  it("tells no drop for a press that never moved", () => {
    const { heard, told } = listening();
    const { toy } = play(heard);
    point(toy, "pointerdown", 400, 300);
    point(toy, "pointerup", 400, 300);
    expect(MutableList.takeAll(told)).toEqual(["grab", "release"]);
  });

  it("is a toy only while it is added, and forgets where it was left once it is taken out", () => {
    const { remove, toy, toys } = play();
    expect(toy.hasAttribute(TOY_ATTRIBUTE)).toBe(true);
    put(toy, 100);
    remove();
    expect(toy.hasAttribute(TOY_ATTRIBUTE)).toBe(false);
    point(toy, "pointerdown", 400, 300);
    expect(toy.dataset.held).toBe("false");
    toys.add(toy, {});
    put(toy, 10);
    expect(offsetOf(toy)).toEqual({ x: 10, y: 0 });
  });
});

describe("a toy sent home", () => {
  it("springs back to its place and rests there", () => {
    const { toy, toys } = play();
    throwToy(toy, 20, 20);
    wait(2000);
    expect(offsetOf(toy)).not.toEqual({ x: 0, y: 0 });
    toys.home(toy);
    wait(4000);
    expect(offsetOf(toy)).toEqual({ x: 0, y: 0 });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("goes home at once for a person who asked for less motion", () => {
    world.calm = true;
    const { toy, toys } = play();
    put(toy, 60);
    toys.home(toy);
    expect(offsetOf(toy)).toEqual({ x: 0, y: 0 });
  });

  it("is put back at once when told to rest", () => {
    const { toy, toys } = play();
    put(toy, 60);
    toys.rest(toy);
    expect(offsetOf(toy)).toEqual({ x: 0, y: 0 });
  });
});

describe("the listeners of the toys", () => {
  it("are one press on the root until a toy is taken, and gone again once it is let go", () => {
    const { parent, root } = room();
    const onRoot = vi.spyOn(root, "addEventListener");
    const onWindow = vi.spyOn(window, "addEventListener");
    const toys = createToys();
    stopped = Arr.append(stopped, toys.attach(root));
    const toy = toyIn(parent);
    const onToy = vi.spyOn(toy, "addEventListener");
    toys.add(toy, {});
    expect(Arr.map(onRoot.mock.calls, ([type]) => type)).toEqual([
      "pointerdown",
    ]);
    expect(onWindow).not.toHaveBeenCalled();
    expect(onToy).not.toHaveBeenCalled();

    point(toy, "pointerdown", 400, 300);
    expect(Arr.map(onWindow.mock.calls, ([type]) => type)).toEqual([
      "pointermove",
      "pointerup",
      "pointercancel",
      "lostpointercapture",
      "scroll",
    ]);
    const signals = Arr.filterMap(onWindow.mock.calls, ([, , options]) =>
      Predicate.hasProperty(options, "signal") &&
      options.signal instanceof AbortSignal
        ? Result.succeed(options.signal)
        : Result.failVoid
    );
    expect(signals).toHaveLength(5);
    expect(Arr.every(signals, (signal) => !signal.aborted)).toBe(true);

    point(toy, "pointerup", 400, 300);
    expect(Arr.every(signals, (signal) => signal.aborted)).toBe(true);
  });
});
