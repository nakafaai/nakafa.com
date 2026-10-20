import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { coverOf } from "@repo/design-system/components/pool/cover";
import {
  createDrive,
  FIRST_HOP,
  HOP_SPREAD,
  HOP_WAIT,
  RESIZE_QUIET,
} from "@repo/design-system/components/pool/drive";
import { poolMembers } from "@repo/design-system/components/pool/member";
import { REST_FRAMES } from "@repo/design-system/components/pool/physics";
import { CHECKED_POOLS } from "@repo/design-system/components/pool/test.fixture";
import { Array as Arr } from "effect";
import type { FrameData } from "motion";
import { createElement, Fragment, type ReactNode } from "react";
import { createRoot } from "react-dom/client";

/** The place of a member's center in the pool's transform, as the drive writes it. */
const PLACE = /translate3d\(([-\d.]+)px, ([-\d.]+)px/;

/**
 * The frame callbacks that the drive has queued. The test stands in for motion's
 * frame loop: `runFrame` runs the callbacks that are due, one frame at a time.
 */
const motion = vi.hoisted(() => {
  const state: {
    queued: { callback: (data: FrameData) => void; keepAlive: boolean }[];
  } = { queued: [] };
  return state;
});

vi.mock("motion", () => ({
  cancelFrame: (callback: (data: FrameData) => void) => {
    motion.queued = Arr.filter(
      motion.queued,
      (queued) => queued.callback !== callback
    );
  },
  frame: {
    render: (callback: (data: FrameData) => void, keepAlive?: boolean) => {
      motion.queued = Arr.append(
        Arr.filter(motion.queued, (queued) => queued.callback !== callback),
        { callback, keepAlive: keepAlive === true }
      );
    },
  },
}));

/** One frame at 60 frames a second, in milliseconds. */
const FRAME_MS = 1000 / 60;
/** The frames that a test allows for a settle, which runs eight frames of the pool at a time. */
const MAX_FRAMES = 400;
/** The longest wait before a hop: the hop wait, plus its spread. */
const LONGEST_HOP_WAIT = HOP_WAIT + HOP_SPREAD;
/** The frames in one second, and the most that a settled pile may take to sleep. */
const FRAMES_PER_SECOND = 60;
/** A fixed draw from zero up to one, so that every hop lifts the same member the same way. */
const FIXED_DRAW = 0.5;
/** The narrowest checked pool, and the widest, which a resize goes to. */
const NARROW = CHECKED_POOLS[0];
const WIDE = CHECKED_POOLS[2];

/** The callback that the drive gave its ResizeObserver, which the test calls to report a resize. */
let observed: () => void = () => undefined;

/** A ResizeObserver that keeps its callback, so that the test reports resizes itself. */
class ResizeObserverDouble {
  constructor(callback: () => void) {
    observed = callback;
  }

  observe() {
    // The test reports the resizes itself, so there is nothing to observe.
  }

  disconnect() {
    // Nothing is observed, so there is nothing to disconnect.
  }
}

/** Runs the callbacks that are due on one frame: a settle runs once, and a loop runs until it sleeps. */
function runFrame(milliseconds = FRAME_MS) {
  const due = motion.queued;
  motion.queued = Arr.filter(due, (queued) => queued.keepAlive);
  Arr.forEach(due, ({ callback }) =>
    callback({ delta: milliseconds, isProcessing: true, timestamp: 0 })
  );
}

/** Whether a settle is still queued: a settle is queued until its last part has run. */
function settling() {
  return Arr.some(motion.queued, (queued) => !queued.keepAlive);
}

/** Whether the frame loop is awake: its callback is queued until the loop sleeps. */
function looping() {
  return Arr.some(motion.queued, (queued) => queued.keepAlive);
}

/** Runs frames until no settle is left, and returns how many frames that took. */
function finishSettle() {
  let frames = 0;
  while (settling() && frames < MAX_FRAMES) {
    runFrame();
    frames += 1;
  }
  return frames;
}

/** Runs frames until the frame loop sleeps, so a pile that falls in has come to rest. */
function runUntilAsleep() {
  let frames = 0;
  while (looping() && frames < MAX_FRAMES) {
    runFrame();
    frames += 1;
  }
  return frames;
}

/** A box of this size, whose measured width and height the test can change. */
function boxOf(width: number, height: number) {
  const element = document.createElement("div");
  setSize(element, width, height);
  return element;
}

/** Gives a box its measured size, as the browser reports it. */
function setSize(element: HTMLElement, width: number, height: number) {
  Object.defineProperties(element, {
    clientHeight: { configurable: true, value: height },
    clientWidth: { configurable: true, value: width },
  });
}

/** Draws the members of a count as plain elements, as React would draw them. */
function drawPlain(element: HTMLElement) {
  return (animals: number) => {
    element.replaceChildren(
      ...Arr.map(poolMembers(animals), () => document.createElement("div"))
    );
  };
}

/** The members of a count as React draws them, each keyed by its name. */
function membersOf(animals: number): ReactNode {
  return createElement(
    Fragment,
    null,
    Arr.map(poolMembers(animals), (member) =>
      createElement("div", { key: member.key })
    )
  );
}

/** The members that the element holds, as the drive sees them. */
function membersIn(element: HTMLElement) {
  return Arr.filter(
    Arr.fromIterable(element.children),
    (node): node is HTMLElement => node instanceof HTMLElement
  );
}

/** The center of a member, read from the place and the size that the drive wrote on it. */
function centerOf(member: HTMLElement) {
  const place = PLACE.exec(member.style.transform);
  return {
    x: Number(place?.[1]) + Number.parseFloat(member.style.width) / 2,
    y: Number(place?.[2]) + Number.parseFloat(member.style.height) / 2,
  };
}

/** The first member of the element, a ball of the pile. */
function firstMember(element: HTMLElement) {
  return Arr.getUnsafe(membersIn(element), 0);
}

/** A pointer event at this place in the box. */
function pointerAt(element: HTMLElement, type: string, x: number, y: number) {
  element.dispatchEvent(
    new MouseEvent(type, { clientX: x, clientY: y, bubbles: true })
  );
}

describe("the drive of one pool", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("ResizeObserver", ResizeObserverDouble);
    motion.queued = [];
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("shows a fresh pool at once, with its pile above the box, and lets the pile fall in", () => {
    const element = boxOf(NARROW.width, NARROW.height);
    const drive = createDrive(element, false, drawPlain(element));
    drive.setVisible(true);
    // The first measure of the box shows it at once: no settle runs before the show.
    observed();
    expect(element.dataset.shown).toBe("true");
    // Every ball starts above the box, so the box shows only the fall.
    expect(
      Arr.every(membersIn(element), (member) => centerOf(member).y < 0)
    ).toBe(true);
    expect(looping()).toBe(true);
    drive.destroy();
  });

  it("lets a shown pile sleep at rest within a second of its loop waking", () => {
    const element = boxOf(NARROW.width, NARROW.height);
    const drive = createDrive(element, false, drawPlain(element));
    drive.setVisible(true);
    observed();
    runUntilAsleep();
    expect(element.dataset.shown).toBe("true");
    // The pile has fallen to rest, so the loop sleeps and no frame is due.
    expect(looping()).toBe(false);
    drive.setVisible(false);
    drive.setVisible(true);
    let frames = 0;
    while (looping() && frames < FRAMES_PER_SECOND) {
      runFrame();
      frames += 1;
    }
    expect(looping()).toBe(false);
    drive.destroy();
  });

  it("ignores a press while a resize settles, and takes one once the new pile is settled", () => {
    const element = boxOf(NARROW.width, NARROW.height);
    const capture = vi.fn();
    element.setPointerCapture = capture;
    const drive = createDrive(element, false, drawPlain(element));
    drive.setVisible(true);
    observed();
    runUntilAsleep();
    setSize(element, WIDE.width, WIDE.height);
    observed();
    vi.advanceTimersByTime(RESIZE_QUIET);
    const old = centerOf(firstMember(element));
    pointerAt(element, "pointerdown", old.x, old.y);
    expect(capture).not.toHaveBeenCalled();
    finishSettle();
    const settled = centerOf(firstMember(element));
    pointerAt(element, "pointerdown", settled.x, settled.y);
    expect(capture).toHaveBeenCalledTimes(1);
    drive.destroy();
  });

  it("takes a grip on a ball, and carries it as the pointer moves", () => {
    const element = boxOf(NARROW.width, NARROW.height);
    const capture = vi.fn();
    element.setPointerCapture = capture;
    const drive = createDrive(element, false, drawPlain(element));
    drive.setVisible(true);
    observed();
    runUntilAsleep();
    const place = centerOf(firstMember(element));
    // Pressing empty space takes no grip, so nothing is captured.
    pointerAt(element, "pointerdown", 1, 1);
    expect(capture).not.toHaveBeenCalled();
    pointerAt(element, "pointerdown", place.x, place.y);
    expect(capture).toHaveBeenCalledTimes(1);
    // A second press while a ball is held takes no other grip.
    pointerAt(element, "pointerdown", place.x, place.y);
    expect(capture).toHaveBeenCalledTimes(1);
    const before = element.innerHTML;
    pointerAt(element, "pointermove", place.x + 30, place.y);
    runFrame();
    expect(element.innerHTML).not.toBe(before);
    // Then the pointer lets go and leaves the box.
    pointerAt(element, "pointerup", place.x + 30, place.y);
    pointerAt(element, "pointerleave", place.x + 30, place.y);
    drive.destroy();
  });

  it("throws a member up once its box has been still in view for the hop wait", () => {
    const element = boxOf(NARROW.width, NARROW.height);
    const drive = createDrive(element, false, drawPlain(element));
    drive.setVisible(true);
    observed();
    runUntilAsleep();
    const still = element.innerHTML;
    vi.advanceTimersByTime(FIRST_HOP);
    expect(looping()).toBe(true);
    runFrame();
    expect(element.innerHTML).not.toBe(still);
    drive.destroy();
  });

  it("throws no member up while its box is out of view, so the settled pile sleeps after its rest frames", () => {
    const element = boxOf(NARROW.width, NARROW.height);
    const drive = createDrive(element, false, drawPlain(element));
    drive.setVisible(true);
    observed();
    runUntilAsleep();
    drive.setVisible(false);
    // Effect draws its random numbers from Math.random, so a fixed draw makes a hop certain.
    vi.spyOn(Math, "random").mockReturnValue(FIXED_DRAW);
    vi.advanceTimersByTime(LONGEST_HOP_WAIT);
    // A hop would keep a ball moving, so the rest count would start again: the loop would run longer.
    drive.setVisible(true);
    let frames = 0;
    while (looping() && frames < MAX_FRAMES) {
      runFrame();
      frames += 1;
    }
    expect(frames).toBe(REST_FRAMES);
    drive.destroy();
  });

  it("settles a resized pool only once its size has been still for the quiet wait", () => {
    const element = boxOf(NARROW.width, NARROW.height);
    const drive = createDrive(element, false, drawPlain(element));
    drive.setVisible(true);
    observed();
    runUntilAsleep();
    setSize(element, WIDE.width, WIDE.height);
    observed();
    vi.advanceTimersByTime(RESIZE_QUIET - 100);
    setSize(element, WIDE.width, NARROW.height);
    observed();
    vi.advanceTimersByTime(RESIZE_QUIET - 100);
    expect(settling()).toBe(false);
    vi.advanceTimersByTime(100);
    expect(settling()).toBe(true);
    drive.destroy();
  });

  it("settles nothing while its box has no width or no height", () => {
    const element = boxOf(0, NARROW.height);
    const drive = createDrive(element, false, drawPlain(element));
    drive.setVisible(true);
    observed();
    expect(settling()).toBe(false);
    setSize(element, NARROW.width, 0);
    observed();
    expect(settling()).toBe(false);
    drive.destroy();
  });

  it("shows a reduced-motion pool without a pointer and without a hop", () => {
    const element = boxOf(NARROW.width, NARROW.height);
    const capture = vi.fn();
    element.setPointerCapture = capture;
    const drive = createDrive(element, true, drawPlain(element));
    drive.setVisible(true);
    observed();
    finishSettle();
    expect(element.dataset.shown).toBe("true");
    const place = centerOf(firstMember(element));
    pointerAt(element, "pointerdown", place.x, place.y);
    expect(capture).not.toHaveBeenCalled();
    vi.advanceTimersByTime(LONGEST_HOP_WAIT);
    expect(looping()).toBe(false);
    drive.destroy();
  });

  it("stops the frame loop when it is destroyed", () => {
    const element = boxOf(NARROW.width, NARROW.height);
    const drive = createDrive(element, false, drawPlain(element));
    drive.setVisible(true);
    observed();
    runUntilAsleep();
    const place = centerOf(firstMember(element));
    pointerAt(element, "pointermove", place.x + 30, place.y);
    expect(looping()).toBe(true);
    drive.destroy();
    expect(looping()).toBe(false);
  });

  it("stops a settle and the hops when it is destroyed", () => {
    const element = boxOf(NARROW.width, NARROW.height);
    const drive = createDrive(element, false, drawPlain(element));
    drive.setVisible(true);
    observed();
    runUntilAsleep();
    setSize(element, WIDE.width, WIDE.height);
    observed();
    vi.advanceTimersByTime(RESIZE_QUIET);
    expect(settling()).toBe(true);
    drive.destroy();
    expect(settling()).toBe(false);
    vi.advanceTimersByTime(LONGEST_HOP_WAIT);
    expect(looping()).toBe(false);
  });

  it("draws the members of the new count before it places the new pile", () => {
    const element = boxOf(NARROW.width, NARROW.height);
    const root = createRoot(element);
    const drive = createDrive(element, false, (animals) =>
      root.render(membersOf(animals))
    );
    drive.setVisible(true);
    observed();
    runUntilAsleep();
    setSize(element, WIDE.width, WIDE.height);
    observed();
    vi.advanceTimersByTime(RESIZE_QUIET);
    const expected = poolMembers(
      coverOf(WIDE.width, WIDE.height).animals
    ).length;
    let frames = 0;
    while (membersIn(element).length !== expected && frames < MAX_FRAMES) {
      runFrame();
      frames += 1;
    }
    expect(membersIn(element).length).toBe(expected);
    drive.destroy();
    root.unmount();
  });
});
