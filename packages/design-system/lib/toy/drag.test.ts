import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import {
  click,
  define,
  FRAME,
  flight,
  leave,
  listening,
  offsetOf,
  play,
  point,
  put,
  ROOM_WALLS,
  stagePage,
  throwToy,
  toyIn,
  wait,
  world,
} from "@repo/design-system/test/toy";
import { Array as Arr, MutableList } from "effect";

beforeEach(stagePage);
afterEach(leave);

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
    for (const taken of [toy, other, toy]) {
      point(taken, "pointerdown", 400, 300);
      point(taken, "pointerup", 400, 300);
    }
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
    expect(offsetOf(toy)).toEqual({ x: ROOM_WALLS.maxX, y: ROOM_WALLS.minY });
    point(toy, "pointermove", -2600, 3300);
    expect(offsetOf(toy)).toEqual({ x: ROOM_WALLS.minX, y: ROOM_WALLS.maxY });
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
});

describe("a toy that pulls the page", () => {
  /** Takes a toy, holds it at height `y` of the window for ten frames, and answers how far the page was pulled. */
  function pulled(y: number) {
    world.scrollY = 1000;
    const { toy } = play();
    point(toy, "pointerdown", 400, 300);
    wait(FRAME);
    point(toy, "pointermove", 400, y);
    wait(10 * FRAME);
    return world.scrollY - 1000;
  }

  it.each([
    { by: -144, where: "top edge", y: 0 },
    { by: 144, where: "bottom edge", y: 800 },
    { by: -72, where: "halfway between the top edge and the middle", y: 42 },
    { by: 72, where: "halfway between the middle and the bottom edge", y: 758 },
  ])(
    "pulls the page by $by pixels in ten frames at the $where: 900 pixels a second at the very edge, and less toward the middle",
    ({ by, y }) => {
      expect(pulled(y)).toBeCloseTo(by, 6);
    }
  );

  it("does not pull the page along in the middle of the window", () => {
    expect(pulled(400)).toBe(0);
  });
});

describe("a toy let go", () => {
  it("never leaves its box when thrown at a wall, and comes to rest", () => {
    const { toy } = play();
    throwToy(toy, 40, 0);
    const offsets = flight(toy, 5000);
    expect(
      Arr.every(
        offsets,
        ({ x }) => x >= ROOM_WALLS.minX && x <= ROOM_WALLS.maxX
      )
    ).toBe(true);
    expect(Arr.some(offsets, ({ x }) => x === ROOM_WALLS.maxX)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
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
});

describe("a hold that is cancelled or whose capture is lost", () => {
  it.each([
    {
      end: (toy: HTMLElement) => point(toy, "pointercancel", 0, 0),
      name: "pointer is cancelled",
    },
    {
      end: (toy: HTMLElement) =>
        toy.dispatchEvent(
          new PointerEvent("lostpointercapture", {
            bubbles: true,
            pointerId: 1,
          })
        ),
      name: "pointer capture is lost",
    },
  ])(
    "is thrown on at the speed of the hand, and the page hears where the hand was, when the $name",
    ({ end }) => {
      const { heard, told } = listening();
      const { toy } = play(heard);
      point(toy, "pointerdown", 300, 200);
      wait(FRAME);
      point(toy, "pointermove", 360, 200);
      const held = offsetOf(toy);
      end(toy);
      expect(toy.dataset.held).toBe("false");
      expect(Arr.some(flight(toy, 1000), ({ x }) => x > held.x)).toBe(true);
      expect(MutableList.takeAll(told)).toEqual([
        "grab",
        "release",
        "drop 360,200",
      ]);
      expect(click(toy).defaultPrevented).toBe(true);
    }
  );
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
