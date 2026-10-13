import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { REST } from "@repo/design-system/lib/toy/flight";
import { createFlock } from "@repo/design-system/lib/toy/flock";
import {
  FRAME,
  flight,
  leave,
  offsetOf,
  room,
  stagePage,
  toyIn,
  wait,
  world,
} from "@repo/design-system/test/toy";
import { Array as Arr, MutableList } from "effect";

beforeEach(stagePage);
afterEach(leave);

/** A flock, and a toy of the room in it that lies at its place. */
function lying() {
  const { parent } = room();
  return { flock: createFlock(), toy: toyIn(parent) };
}

describe("toys that no hand holds", () => {
  it("lie where they were left, and are forgotten when they are told to be", () => {
    const { flock, toy } = lying();
    expect(flock.toyOf(toy)).toBe(REST);
    flock.keep(toy, { ...REST, x: 30 });
    expect(flock.toyOf(toy)).toEqual({ ...REST, x: 30 });
    expect(toy.style.transform).toBe("");
    flock.forget(toy);
    expect(flock.toyOf(toy)).toBe(REST);
  });

  it("fly on the speed they were given, turn back at the wall of their box, and come to rest", () => {
    const { flock, toy } = lying();
    flock.paint(toy, { ...REST, vx: 2200 });
    flock.wake();
    const offsets = flight(toy, 5000);
    expect(Arr.some(offsets, ({ x }) => x === 544)).toBe(true);
    expect(Arr.every(offsets, ({ x }) => x >= 0 && x <= 544)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("go home on a spring, and rest at their place", () => {
    const { flock, toy } = lying();
    flock.paint(toy, { ...REST, x: 120, y: -50 });
    flock.home(toy);
    wait(4000);
    expect(offsetOf(toy)).toEqual({ x: 0, y: 0 });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("go home at once for a person who asked for less motion", () => {
    world.calm = true;
    const { flock, toy } = lying();
    flock.paint(toy, { ...REST, x: 120, y: -50 });
    flock.home(toy);
    expect(offsetOf(toy)).toEqual({ x: 0, y: 0 });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("are put back at once, with no motion, when told to rest", () => {
    const { flock, toy } = lying();
    flock.paint(toy, { ...REST, vx: 900, x: 120 });
    flock.rest(toy);
    expect(offsetOf(toy)).toEqual({ x: 0, y: 0 });
    expect(flock.toyOf(toy)).toBe(REST);
  });
});

describe("the frames of the toys", () => {
  it("take no step in a frame that began before the loop woke up, and a whole step in the one after", () => {
    const asked = MutableList.make<FrameRequestCallback>();
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      MutableList.append(asked, callback);
      return 1;
    });
    /** Runs the oldest frame that was asked for, at the time the browser stamped it with. */
    const run = (stamp: number) => {
      const callback = MutableList.take(asked);
      if (callback !== MutableList.Empty) {
        callback(stamp);
      }
    };
    const { flock, toy } = lying();
    flock.paint(toy, { ...REST, vx: 2200 });
    wait(FRAME);
    flock.wake();
    // The loop woke up at 16, and the frame it got began at 10.
    run(10);
    expect(offsetOf(toy)).toEqual({ x: 0, y: 0 });
    run(10 + FRAME);
    expect(offsetOf(toy).x).toBeGreaterThan(30);
  });

  it("are asked for once however often the loop is woken, and dropped when the toys are stopped", () => {
    const { flock, toy } = lying();
    flock.paint(toy, { ...REST, vx: 900 });
    flock.wake();
    flock.wake();
    expect(vi.getTimerCount()).toBe(1);
    flock.stop();
    expect(vi.getTimerCount()).toBe(0);
    wait(5 * FRAME);
    expect(offsetOf(toy)).toEqual({ x: 0, y: 0 });
  });
});
