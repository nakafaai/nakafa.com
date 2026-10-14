"use client";

import { useInViewport, useMergedRef, useReducedMotion } from "@mantine/hooks";
import {
  POOL_MEMBERS,
  type PoolMember,
  poolWorld,
} from "@repo/design-system/components/pool/member";
import {
  hop,
  isResting,
  leave,
  move,
  press,
  release,
  resize,
  settle,
  tick,
  type World,
} from "@repo/design-system/components/pool/physics";
import { Animal } from "@repo/design-system/components/ui/character";
import { Thing } from "@repo/design-system/components/ui/thing";
import { Array as Arr, Effect, Random } from "effect";
import { cancelFrame, type FrameData, frame } from "motion";
import { useEffect, useEffectEvent, useRef } from "react";

/** The time of a frame that has none before it, in seconds. */
const FIRST_FRAME = 0.016;
/** The loop sleeps once the pile has rested for this many frames, with nobody holding or pointing. */
const REST_FRAMES = 20;
/**
 * Reduced motion settles the pile this many steps in a box, eight seconds at the
 * fixed step (see the step in physics.ts). Measured on the 30 members in 20 box
 * sizes, the loop would sleep at once after this many steps in 18 of them.
 */
const SETTLE_STEPS = 3840;
/** Reduced motion settles a box again once it has been still this many milliseconds, so one drag costs one settle. */
const RESIZE_QUIET = 150;
/** The first hop comes this many milliseconds after the pool starts. */
const FIRST_HOP = 3600;
/** Each hop waits this many milliseconds, plus up to the spread. */
const HOP_WAIT = 2800;
const HOP_SPREAD = 2600;

/** A number from zero up to one, from Effect's random source, drawn at an event. */
function draw() {
  return Effect.runSync(Random.next);
}

/** One member of the pool, drawn once. The frame loop writes its place, not React. */
function Member({ member }: { member: PoolMember }) {
  return (
    <div className="absolute top-0 left-0">
      {member.kind === "animal" ? (
        <Animal className="size-full rounded-full" mascot={member.mascot} />
      ) : (
        <Thing className="size-full" name={member.name} />
      )}
    </div>
  );
}

/**
 * The animal pool of the sign-in page: animals and things that fall, pile up,
 * and move away from the pointer. React draws each member once. A frame writes
 * only where each member is and how it leans, straight onto its element. The
 * loop sleeps while the pile rests, and wakes for the pointer, a resize, a hop,
 * or a view of the box. With reduced motion there is no loop and no pointer.
 */
export function Pool() {
  const calm = useReducedMotion(undefined, { getInitialValueInEffect: false });
  const { inViewport, ref: watch } = useInViewport<HTMLDivElement>();
  const box = useRef<HTMLDivElement>(null);
  const place = useMergedRef(box, watch);
  const drive = useRef<Drive | undefined>(undefined);
  const viewing = useEffectEvent(() => inViewport);

  useEffect(() => {
    if (!box.current) {
      return;
    }
    const created = createDrive(box.current, calm);
    drive.current = created;
    created.setVisible(viewing());
    return () => {
      drive.current = undefined;
      created.destroy();
    };
  }, [calm]);

  useEffect(() => {
    drive.current?.setVisible(inViewport);
  }, [inViewport]);

  return (
    <div
      aria-hidden
      className="absolute inset-0 overflow-hidden"
      data-slot="pool"
      ref={place}
    >
      {Arr.map(POOL_MEMBERS, (member) => (
        <Member key={member.key} member={member} />
      ))}
    </div>
  );
}

type Drive = ReturnType<typeof createDrive>;

/**
 * Drives the pool of one box: its world, its frame loop, its pointer, its hops,
 * and its size. It writes to the elements that React drew, and never draws with
 * React itself.
 */
function createDrive(element: HTMLDivElement, calm: boolean) {
  const members = Arr.filter(
    Arr.fromIterable(element.children),
    (node): node is HTMLElement => node instanceof HTMLElement
  );
  const pointers = new AbortController();
  let world: World | undefined;
  let visible = false;
  let running = false;
  let still = 0;
  let hopping: number | undefined;
  let quiet: number | undefined;

  /** Writes where each member is and how it leans, straight onto its element. */
  function paint(current: World) {
    Arr.forEach(Arr.zip(members, current.balls), ([node, ball]) => {
      node.style.transform = `translate3d(${(ball.x - ball.r).toFixed(1)}px, ${(ball.y - ball.r).toFixed(1)}px, 0) rotate(${ball.tilt.toFixed(1)}deg)`;
    });
  }

  /** Gives each member its size, and places the pool, on the first real size of the box. */
  function start(width: number, height: number) {
    const first = poolWorld(width, height);
    Arr.forEach(Arr.zip(members, first.balls), ([node, ball]) => {
      node.style.width = `${ball.r * 2}px`;
      node.style.height = `${ball.r * 2}px`;
    });
    world = calm ? settle(first, SETTLE_STEPS) : first;
    paint(world);
    wake();
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
    if (still >= REST_FRAMES && world.held === null && !world.pointer.active) {
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
    if (world === undefined) {
      start(width, height);
      return;
    }
    if (calm) {
      window.clearTimeout(quiet);
      quiet = window.setTimeout(
        () => start(element.clientWidth, element.clientHeight),
        RESIZE_QUIET
      );
      return;
    }
    world = resize(world, width, height);
    wake();
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
      sleep();
    },
    setVisible,
  };
}
