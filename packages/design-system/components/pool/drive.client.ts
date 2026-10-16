"use client";

import { coverOf } from "@repo/design-system/components/pool/cover";
import { poolStarts } from "@repo/design-system/components/pool/member";
import {
  hop,
  isResting,
  leave,
  move,
  press,
  REST_FRAMES,
  release,
  resize,
  tick,
  type World,
} from "@repo/design-system/components/pool/physics";
import { createWorld, fit } from "@repo/design-system/components/pool/place";
import {
  finishSettle,
  isSettled,
  type Settling,
  settleFor,
  startSettle,
} from "@repo/design-system/components/pool/settle";
import { Array as Arr, Effect, Random } from "effect";
import { cancelFrame, type FrameData, frame } from "motion";

/** The time of a frame that has none before it, in seconds. */
const FIRST_FRAME = 0.016;
/**
 * Reduced motion settles a box again once it has been still this many
 * milliseconds. The search and the chat sidebar wait 500 milliseconds before they
 * act on a change too. A pause in the middle of a drag that is this long settles
 * the pile again.
 */
const RESIZE_QUIET = 500;
/** The first hop comes this many milliseconds after the pool starts. */
const FIRST_HOP = 3600;
/** Each hop waits this many milliseconds, plus up to the spread. */
const HOP_WAIT = 2800;
const HOP_SPREAD = 2600;
/**
 * The frames of a reduced-motion settle that run in each animation frame. A settle
 * runs in these parts, so that no single frame blocks the page for long.
 */
const SETTLE_CHUNK_FRAMES = 8;

/** A number from zero up to one, from Effect's random source, drawn at an event. */
function draw() {
  return Effect.runSync(Random.next);
}

/**
 * Drives the pool of one box: its world, its frame loop, its pointer, its hops,
 * and its size. It writes to the elements that React drew, and never draws with
 * React itself. Each time the box takes a new count of animals, `onAnimals` hears
 * it, and React draws the members of that count; `sync` then gives each member its
 * size and place.
 */
export function createDrive(
  element: HTMLDivElement,
  calm: boolean,
  onAnimals: (animals: number) => void
) {
  const pointers = new AbortController();
  let members: readonly HTMLElement[] = [];
  let world: World | undefined;
  let visible = false;
  let running = false;
  let still = 0;
  let hopping: number | undefined;
  let quiet: number | undefined;
  let settling: Settling | undefined;
  let settlingAnimals = 0;

  /** Writes where each member is and how it leans, straight onto its element. */
  function paint(current: World) {
    Arr.forEach(Arr.zip(members, current.balls), ([node, ball]) => {
      node.style.transform = `translate3d(${(ball.x - ball.r).toFixed(1)}px, ${(ball.y - ball.r).toFixed(1)}px, 0) rotate(${ball.tilt.toFixed(1)}deg)`;
    });
  }

  /** Reads the members that React drew, and gives each its size and its place. */
  function sync() {
    members = Arr.filter(
      Arr.fromIterable(element.children),
      (node): node is HTMLElement => node instanceof HTMLElement
    );
    if (world === undefined) {
      return;
    }
    Arr.forEach(Arr.zip(members, world.balls), ([node, ball]) => {
      node.style.width = `${ball.r * 2}px`;
      node.style.height = `${ball.r * 2}px`;
    });
    paint(world);
  }

  /**
   * Makes the world match a box of this size: its walls, and its animals. The
   * animals that stay keep their place. With reduced motion the pile settles in
   * parts, and the old pile stays until the new one has come to rest.
   */
  function update(width: number, height: number) {
    const cover = coverOf(width, height);
    const starts = poolStarts(cover);
    const next =
      world === undefined
        ? createWorld(width, height, starts)
        : fit(resize(world, width, height), starts);
    if (!calm) {
      world = next;
      onAnimals(cover.animals);
      sync();
      wake();
      return;
    }
    settlingAnimals = cover.animals;
    settling = startSettle(next);
    cancelFrame(settleChunk);
    frame.render(settleChunk);
  }

  /** Runs one part of a reduced-motion settle, and shows the pile once it has come to rest. */
  function settleChunk() {
    if (settling === undefined) {
      return;
    }
    settling = settleFor(settling, SETTLE_CHUNK_FRAMES);
    if (!isSettled(settling)) {
      frame.render(settleChunk);
      return;
    }
    world = finishSettle(settling);
    settling = undefined;
    onAnimals(settlingAnimals);
    sync();
  }

  /** Starts the frame loop, unless it runs already, the box is out of view, or the person asked for less motion. */
  function wake() {
    if (world === undefined || running || !visible || calm) {
      return;
    }
    still = 0;
    running = true;
    frame.render(advance, true);
  }

  /** Stops the frame loop. */
  function sleep() {
    running = false;
    cancelFrame(advance);
  }

  /** One frame: the pile moves and is painted, and the loop sleeps once the pile has rested. */
  function advance({ delta }: FrameData) {
    if (world === undefined) {
      return;
    }
    world = tick(world, delta / 1000 || FIRST_FRAME);
    paint(world);
    still = isResting(world) ? still + 1 : 0;
    if (still >= REST_FRAMES && world.held === null) {
      sleep();
    }
  }

  /** Where the pointer is, in pixels from the top left corner of the box. */
  function locate(event: PointerEvent) {
    const box = element.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  }

  function onMove(event: PointerEvent) {
    if (world === undefined) {
      return;
    }
    world = move(world, locate(event));
    wake();
  }

  function onLeave() {
    if (world === undefined) {
      return;
    }
    world = leave(world);
  }

  function onDown(event: PointerEvent) {
    if (world === undefined) {
      return;
    }
    const holding = world.held !== null;
    world = press(world, locate(event));
    if (!holding && world.held !== null) {
      element.setPointerCapture(event.pointerId);
    }
    wake();
  }

  function onUp() {
    if (world === undefined) {
      return;
    }
    world = release(world);
    wake();
  }

  /** Waits, then throws one member up if the box is in view, the pile is still, and nothing is held. */
  function hopAt(wait: number) {
    hopping = window.setTimeout(hopNow, wait);
  }

  function hopNow() {
    hopAt(HOP_WAIT + draw() * HOP_SPREAD);
    if (!visible || running || world === undefined || world.held !== null) {
      return;
    }
    const index = Effect.runSync(
      Random.nextIntBetween(0, world.balls.length, { halfOpen: true })
    );
    world = hop(world, index, draw(), draw());
    wake();
  }

  /** Learns whether the box is in view. The loop runs only while it is. */
  function setVisible(inView: boolean) {
    visible = inView;
    if (inView) {
      wake();
    } else {
      sleep();
    }
  }

  const resizing = new ResizeObserver(() => {
    const width = element.clientWidth;
    const height = element.clientHeight;
    if (width === 0 || height === 0) {
      return;
    }
    if (world === undefined || !calm) {
      update(width, height);
      return;
    }
    window.clearTimeout(quiet);
    quiet = window.setTimeout(
      () => update(element.clientWidth, element.clientHeight),
      RESIZE_QUIET
    );
  });
  resizing.observe(element);

  if (!calm) {
    const listening = { signal: pointers.signal };
    element.addEventListener("pointermove", onMove, {
      ...listening,
      passive: true,
    });
    element.addEventListener("pointerleave", onLeave, listening);
    element.addEventListener("pointerdown", onDown, listening);
    element.addEventListener("pointerup", onUp, listening);
    element.addEventListener("pointercancel", onUp, listening);
    hopAt(FIRST_HOP);
  }

  return {
    destroy() {
      resizing.disconnect();
      pointers.abort();
      window.clearTimeout(hopping);
      window.clearTimeout(quiet);
      cancelFrame(settleChunk);
      sleep();
    },
    setVisible,
    sync,
  };
}

/** The driver of one pool. */
export type Drive = ReturnType<typeof createDrive>;
