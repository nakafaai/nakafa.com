import { afterEach, describe, expect, it } from "@effect/vitest";
import {
  boundsOf,
  createSwallow,
  sampleOf,
  scrollOf,
  TOY_ATTRIBUTE,
  toyAt,
} from "@repo/design-system/lib/toy/dom";
import {
  click,
  define,
  leave,
  ROOM_WALLS,
  room,
  stagePage,
  toyIn,
  wait,
  world,
} from "@repo/design-system/test/toy";
import { Option } from "effect";

afterEach(leave);

describe("the walls of a toy", () => {
  it("are the box of its parent, measured from the place the toy lies at", () => {
    const { parent } = room();
    // A toy of 56 at (200, 150) in a parent of 800 by 600.
    expect(boundsOf(toyIn(parent))).toEqual(Option.some(ROOM_WALLS));
  });

  it("are none for a toy with no parent to measure", () => {
    const { parent } = room();
    const toy = toyIn(parent);
    define(toy, { offsetParent: null });
    expect(Option.isNone(boundsOf(toy))).toBe(true);
  });
});

describe("the click that follows a drag", () => {
  it("is swallowed on a toy before the toy hears it, once, and a click elsewhere passes", () => {
    const { parent, root } = room();
    const toy = toyIn(parent);
    toy.setAttribute(TOY_ATTRIBUTE, "");
    const heard = vi.fn();
    toy.addEventListener("click", heard);
    createSwallow().arm(root);
    expect(click(parent).defaultPrevented).toBe(false);
    expect(click(toy).defaultPrevented).toBe(true);
    expect(heard).not.toHaveBeenCalled();
    expect(click(toy).defaultPrevented).toBe(false);
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it("is let through once the wait for it is cleared, and clearing again needs no care", () => {
    const { parent, root } = room();
    const toy = toyIn(parent);
    toy.setAttribute(TOY_ATTRIBUTE, "");
    const swallow = createSwallow();
    swallow.clear();
    swallow.arm(root);
    swallow.clear();
    swallow.clear();
    expect(click(toy).defaultPrevented).toBe(false);
  });
});

describe("the toy a press landed on", () => {
  it("is the nearest marked element around the target, inside the root", () => {
    const { parent, root } = room();
    const toy = toyIn(parent);
    toy.setAttribute(TOY_ATTRIBUTE, "");
    const inner = document.createElement("span");
    toy.append(inner);
    expect(toyAt(root, toy)).toEqual(Option.some(toy));
    expect(toyAt(root, inner)).toEqual(Option.some(toy));
  });

  it("is nothing for a target that is no element, no toy, or only a toy around the root", () => {
    const { parent, root } = room();
    const toy = toyIn(parent);
    const around = document.createElement("div");
    around.setAttribute(TOY_ATTRIBUTE, "");
    document.body.append(around);
    around.append(root);
    root.append("text");
    expect(Option.isNone(toyAt(root, null))).toBe(true);
    expect(Option.isNone(toyAt(root, root.lastChild))).toBe(true);
    expect(Option.isNone(toyAt(root, toy))).toBe(true);
    expect(Option.isNone(toyAt(root, root))).toBe(true);
  });
});

describe("what a press reads of the page", () => {
  it("is where the pointer is and when it was read, and how far the page is scrolled", () => {
    stagePage();
    wait(40);
    world.scrollY = 120;
    const event = new PointerEvent("pointermove", { clientX: 31, clientY: 47 });
    expect(sampleOf(event)).toEqual({ t: 40, x: 31, y: 47 });
    expect(scrollOf()).toEqual({ x: 0, y: 120 });
  });
});
