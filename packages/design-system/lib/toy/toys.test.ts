import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { TOY_ATTRIBUTE } from "@repo/design-system/lib/toy/dom";
import { createToys } from "@repo/design-system/lib/toy/toys";
import {
  FRAME,
  leave,
  listening,
  offsetOf,
  play,
  point,
  put,
  room,
  stagePage,
  throwToy,
  tiltOf,
  toyIn,
  wait,
  world,
} from "@repo/design-system/test/toy";
import { Array as Arr, MutableList, Predicate, Result } from "effect";

beforeEach(stagePage);
afterEach(leave);

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
});

describe("a toy taken in and out", () => {
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

  it("is not written back when it is taken out while a hand holds it", () => {
    const { remove, toy } = play();
    point(toy, "pointerdown", 400, 300);
    wait(FRAME);
    point(toy, "pointermove", 440, 300);
    remove();
    const written = toy.style.transform;
    point(toy, "pointermove", 500, 300);
    point(toy, "pointerup", 500, 300);
    wait(1000);
    expect(toy.style.transform).toBe(written);
    expect(toy.dataset.held).toBe("false");
    expect(vi.getTimerCount()).toBe(0);
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

describe("a toy sent home or put at rest while a hand holds it", () => {
  /** Takes a toy and drags it 80 pixels to the right, then answers it. */
  function dragged() {
    const held = play();
    point(held.toy, "pointerdown", 400, 300);
    wait(FRAME);
    point(held.toy, "pointermove", 480, 300);
    return held;
  }

  it("stays under the hand when it is sent home, and goes home when the hand lets go", () => {
    const { toy, toys } = dragged();
    toys.home(toy);
    wait(10 * FRAME);
    expect(offsetOf(toy)).toEqual({ x: 80, y: 0 });
    point(toy, "pointermove", 500, 300);
    expect(offsetOf(toy)).toEqual({ x: 100, y: 0 });
    wait(96);
    point(toy, "pointerup", 500, 300);
    expect(offsetOf(toy)).toEqual({ x: 100, y: 0 });
    wait(4000);
    expect(offsetOf(toy)).toEqual({ x: 0, y: 0 });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("goes home at once when the hand lets go, for a person who asked for less motion", () => {
    world.calm = true;
    const { toy, toys } = dragged();
    toys.home(toy);
    expect(offsetOf(toy)).toEqual({ x: 80, y: 0 });
    wait(96);
    point(toy, "pointerup", 480, 300);
    expect(offsetOf(toy)).toEqual({ x: 0, y: 0 });
  });

  it("keeps its place under the hand and loses its lean when it is put at rest", () => {
    const { toy, toys } = dragged();
    expect(tiltOf(toy)).not.toBe(0);
    toys.rest(toy);
    expect(offsetOf(toy)).toEqual({ x: 80, y: 0 });
    expect(tiltOf(toy)).toBe(0);
    point(toy, "pointermove", 490, 300);
    expect(offsetOf(toy)).toEqual({ x: 90, y: 0 });
  });

  it("forgets that it was sent home when it is put at rest", () => {
    const { toy, toys } = dragged();
    toys.home(toy);
    toys.rest(toy);
    wait(96);
    point(toy, "pointerup", 480, 300);
    wait(4000);
    expect(offsetOf(toy)).toEqual({ x: 80, y: 0 });
  });
});

describe("the listeners of the toys", () => {
  it("are one press on the root until a toy is taken, and gone again once it is let go", () => {
    const { parent, root } = room();
    const onRoot = vi.spyOn(root, "addEventListener");
    const onWindow = vi.spyOn(window, "addEventListener");
    const toys = createToys();
    const stop = toys.attach(root);
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
    stop();
  });

  it("are gone when the toys are stopped, a toy in a hand is let go, and stopping again needs no care", () => {
    const { parent, root } = room();
    const toys = createToys();
    const stop = toys.attach(root);
    const flying = toyIn(parent);
    const toy = toyIn(parent);
    toys.add(flying, {});
    toys.add(toy, {});
    throwToy(flying, 20, 0);
    point(toy, "pointerdown", 400, 300);
    wait(FRAME);
    point(toy, "pointermove", 460, 300);
    stop();
    // Neither the toy that flies nor the one in the hand asks for another frame.
    expect(toy.dataset.held).toBe("false");
    expect(vi.getTimerCount()).toBe(0);
    point(toy, "pointermove", 600, 300);
    expect(offsetOf(toy)).toEqual({ x: 60, y: 0 });
    expect(() => stop()).not.toThrow();
  });
});
