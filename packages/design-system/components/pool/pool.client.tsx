"use client";

import { useInViewport, useMergedRef, useReducedMotion } from "@mantine/hooks";
import { coverOf } from "@repo/design-system/components/pool/cover";
import {
  type PoolMember,
  poolMembers,
  poolStarts,
} from "@repo/design-system/components/pool/member";
import {
  hop,
  isResting,
  leave,
  move,
  press,
  REST_FRAMES,
  release,
  resize,
  settle,
  tick,
  type World,
} from "@repo/design-system/components/pool/physics";
import { createWorld, fit } from "@repo/design-system/components/pool/place";
import { Animal } from "@repo/design-system/components/ui/animal";
import { Thing } from "@repo/design-system/components/ui/thing";
import { cva } from "class-variance-authority";
import { Array as Arr, Effect, Random } from "effect";
import { cancelFrame, type FrameData, frame } from "motion";
import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

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

/** A number from zero up to one, from Effect's random source, drawn at an event. */
function draw() {
  return Effect.runSync(Random.next);
}

/**
 * The box of one member. An animal fills a circle, as it does in an avatar, and
 * a thing keeps its own outline.
 */
const memberVariants = cva("absolute top-0 left-0", {
  variants: {
    kind: { animal: "overflow-hidden rounded-full", thing: "" },
  },
});

/** One member of the pool, drawn once. The frame loop writes its place, not React. */
function Member({ member }: { member: PoolMember }) {
  return (
    <div className={memberVariants({ kind: member.kind })}>
      {member.kind === "animal" ? (
        <Animal mascot={member.mascot} />
      ) : (
        <Thing className="size-full" name={member.name} />
      )}
    </div>
  );
}

/**
 * Drives the pool of one box: its world, its frame loop, its pointer, its hops,
 * and its size. It writes to the elements that React drew, and never draws with
 * React itself. Each time the box takes a new count of animals, `onAnimals` hears
 * it, and React draws the members of that count; `sync` then gives each member its
 * size and place.
 */
function createDrive(
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
   * animals that stay keep their place. With reduced motion the pile settles again.
   */
  function update(width: number, height: number) {
    const cover = coverOf(width, height);
    const starts = poolStarts(cover);
    const next =
      world === undefined
        ? createWorld(width, height, starts)
        : fit(resize(world, width, height), starts);
    world = calm ? settle(next) : next;
    onAnimals(cover.animals);
    sync();
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
      sleep();
    },
    setVisible,
    sync,
  };
}

/** The driver of one pool. */
type Drive = ReturnType<typeof createDrive>;

/**
 * The animal pool of the sign-in page: animals and things that fall, pile up,
 * and move away from the pointer. The animals cover about half of the box, so the
 * box sets how many of them React draws. Each frame writes only where each member
 * is and how it leans, straight onto its element. The loop sleeps while the pile
 * rests, and wakes for the pointer, a resize, a hop, or a view of the box. With
 * reduced motion there is no loop and no pointer.
 */
export function Pool() {
  const calm = useReducedMotion(undefined, { getInitialValueInEffect: false });
  const { inViewport, ref: watch } = useInViewport<HTMLDivElement>();
  const box = useRef<HTMLDivElement>(null);
  const place = useMergedRef(box, watch);
  const drive = useRef<Drive | undefined>(undefined);
  const [animals, setAnimals] = useState(0);
  const viewing = useEffectEvent(() => inViewport);

  useEffect(() => {
    if (!box.current) {
      return;
    }
    const created = createDrive(box.current, calm, setAnimals);
    drive.current = created;
    created.setVisible(viewing());
    return () => {
      drive.current = undefined;
      created.destroy();
    };
  }, [calm]);

  // After each render React may have drawn a new count of members, so the drive gives every member its size and place before the paint.
  useLayoutEffect(() => {
    drive.current?.sync();
  });

  useEffect(() => {
    drive.current?.setVisible(inViewport);
  }, [inViewport]);

  // Nothing is drawn until the box has been measured: a count of zero stands for that.
  const members = animals === 0 ? [] : poolMembers(animals);

  return (
    <div
      aria-hidden
      className="absolute inset-0 overflow-hidden"
      data-slot="pool"
      ref={place}
    >
      {Arr.map(members, (member) => (
        <Member key={member.key} member={member} />
      ))}
    </div>
  );
}
