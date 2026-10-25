import { coverOf } from "@repo/design-system/components/pool/cover";
import { poolStarts } from "@repo/design-system/components/pool/member";
import {
  hop,
  leave,
  mayRest,
  move,
  press,
  release,
  resize,
  restedFor,
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
import { flushSync } from "react-dom";

/**
 * A box settles its pile again once it has been still this many milliseconds. The
 * search and the chat sidebar wait 500 milliseconds before they act on a change
 * too. A pause in the middle of a drag that is this long settles the pile again.
 */
export const RESIZE_QUIET = 500;
/** The first hop comes this many milliseconds after the pool starts. */
export const FIRST_HOP = 3600;
/** Each hop waits this many milliseconds, plus up to the spread. */
export const HOP_WAIT = 2800;
export const HOP_SPREAD = 2600;
/**
 * The frames of a settle that run in each animation frame. A settle runs in these
 * parts, so that no single frame blocks the page for long.
 */
const SETTLE_CHUNK_FRAMES = 8;

/** A number from zero up to one, from Effect's random source, drawn at an event. */
function draw() {
  return Effect.runSync(Random.next);
}

/**
 * Drives the pool of one box: its world, its frame loop, its pointer, its hops,
 * and its size. With motion, the first pile starts above the box and falls in, so
 * the box shows it at once and the frame loop runs it until it rests. With reduced
 * motion, a pile settles in parts between animation frames before the box shows it,
 * and no frame loop runs for it. A resize settles the new pile the same way while the
 * old one stays on screen. After that the frame loop runs only for the pointer and for
 * the hops. It writes to the elements that React drew, and never draws with React
 * itself. Each time the box takes a new count of animals, `onAnimals` hears it, and
 * React draws the members of that count; `sync` then gives each member its size and
 * place.
 */
export function createDrive(
  element: HTMLDivElement,
  calm: boolean,
  onAnimals: (animals: number) => void
) {
  const pointers = new AbortController();
  let members: readonly HTMLElement[] = [];
  // The pool is empty until the box is first measured, and `fit` then gives it its balls.
  let world: World = createWorld(0, 0, []);
  let measured = false;
  let visible = false;
  let running = false;
  let rested = 0;
  let hopping: number | undefined;
  let quiet: number | undefined;
  let settling: Settling = startSettle(world);
  // Whether a settle is queued: a pile that is settling is not the one on screen yet.
  let settleUnderWay = false;
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
    Arr.forEach(Arr.zip(members, world.balls), ([node, ball]) => {
      node.style.width = `${ball.r * 2}px`;
      node.style.height = `${ball.r * 2}px`;
    });
    paint(world);
  }

  /**
   * Makes the world match a box of this size: its walls, and its animals. The
   * animals that stay keep their place. The first pile with motion is not settled: it
   * starts above the box and falls in. Any other new pile settles in parts between
   * animation frames, and the old pile stays on screen until the new one has come to
   * rest.
   */
  function update(width: number, height: number) {
    const cover = coverOf(width, height);
    if (!(measured || calm)) {
      show(createWorld(width, height, poolStarts(cover)), cover.animals);
      wake();
      return;
    }
    settlingAnimals = cover.animals;
    settleUnderWay = true;
    settling = startSettle(
      fit(resize(world, width, height), poolStarts(cover))
    );
    sleep();
    cancelFrame(settleChunk);
    frame.render(settleChunk);
  }

  /**
   * Runs one part of a settle, and shows the new pile once it has come to rest. The
   * shown pile then stands still until the pointer or a hop moves it.
   */
  function settleChunk() {
    settling = settleFor(settling, SETTLE_CHUNK_FRAMES);
    if (!isSettled(settling)) {
      frame.render(settleChunk);
      return;
    }
    settleUnderWay = false;
    show(finishSettle(settling), settlingAnimals);
  }

  /**
   * Shows a pile with the members of its count: React draws the members, the drive
   * places them, and the box fades in.
   */
  function show(next: World, animals: number) {
    world = next;
    measured = true;
    // React commits a state update later, so the new members are drawn first: placing
    // the new pile on the old members would show a mix of both piles for one frame.
    flushSync(() => onAnimals(animals));
    sync();
    // The pool's CSS fades the box in when this is set, and shows it at once under
    // reduced motion.
    element.dataset.shown = "true";
  }

  /**
   * Starts the frame loop, unless it runs already, a settle is under way, the box is
   * out of view, or the person asked for less motion.
   */
  function wake() {
    if (!measured || running || !visible || calm || settleUnderWay) {
      return;
    }
    rested = 0;
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
    world = tick(world, delta / 1000);
    paint(world);
    rested = restedFor(rested, world);
    if (mayRest(rested, world)) {
      sleep();
    }
  }

  /** Where the pointer is, in pixels from the top left corner of the box. */
  function locate(event: PointerEvent) {
    const box = element.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  }

  function onMove(event: PointerEvent) {
    world = move(world, locate(event));
    wake();
  }

  function onLeave() {
    world = leave(world);
  }

  function onDown(event: PointerEvent) {
    // A pile that is still settling is not the one on screen yet, and a ball taken
    // now would be lost when the settle ends, so the press is ignored.
    if (settleUnderWay) {
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
    world = release(world);
    wake();
  }

  /** Waits, then throws one member up if the box is in view, its loop sleeps, and its pile has settled. */
  function hopAt(wait: number) {
    hopping = window.setTimeout(hopNow, wait);
  }

  function hopNow() {
    hopAt(HOP_WAIT + draw() * HOP_SPREAD);
    // A held ball keeps the loop awake, so a hop never finds a ball held with the loop asleep.
    if (!(measured && visible) || running || settleUnderWay) {
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

  /**
   * Settles the pile for the box's size now, unless the box has no size, as when a
   * narrow screen hides it.
   */
  function settleBox() {
    const width = element.clientWidth;
    const height = element.clientHeight;
    if (width === 0 || height === 0) {
      return;
    }
    update(width, height);
  }

  const resizing = new ResizeObserver(() => {
    if (!measured) {
      settleBox();
      return;
    }
    window.clearTimeout(quiet);
    quiet = window.setTimeout(settleBox, RESIZE_QUIET);
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
