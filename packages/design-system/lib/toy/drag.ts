import { isCalm } from "@repo/design-system/lib/calm";
import {
  boundsOf,
  createSwallow,
  sampleOf,
  scrollOf,
  toyAt,
} from "@repo/design-system/lib/toy/dom";
import {
  frameSeconds,
  isMoving,
  type Point,
} from "@repo/design-system/lib/toy/flight";
import type { createFlock } from "@repo/design-system/lib/toy/flock";
import {
  carry,
  drag,
  follow,
  grab,
  type Hold,
  release,
} from "@repo/design-system/lib/toy/hand";
import { Option } from "effect";

/** What a toy tells its page: taken, let go, and, after a drag, where the hand let go. */
export interface Reactions {
  drop?: (point: Point) => void;
  grab?: () => void;
  release?: () => void;
}

/** The toy in a hand: its element and what it tells its page, the hand, the listeners that exist only for this hold, and the pointer that holds it. */
interface Held {
  el: HTMLElement;
  heard: Reactions;
  hold: Hold;
  listening: AbortController;
  pointer: number;
  root: HTMLElement;
}

/**
 * A hand that picks up the toys of a page, one toy at a time. A press on a toy
 * takes it: it follows the hand from the point where it was taken, stays inside
 * its positioned parent, and answers to one pointer, until the hand lets go,
 * is interrupted, or loses the pointer capture. A press that does not move is
 * still a click, and a drag is not one. A held toy follows the page when it
 * scrolls and pulls it along near the top or bottom of the window.
 *
 * Nothing listens until a toy is taken: the pointer, the scroll and the frames
 * that pull the page exist only while a hand holds a toy. `reactionsOf` says
 * what a toy tells its page; a press takes only a toy that tells something.
 */
export function createDrag(
  flock: ReturnType<typeof createFlock>,
  reactionsOf: (el: HTMLElement) => Option.Option<Reactions>
) {
  let held = Option.none<Held>();
  // Swallows the click which follows a drag, until the next press.
  const swallow = createSwallow();
  // The layer of the toy taken last: each toy taken rises above the last.
  let raised = 10;
  let frame = 0;
  let last = 0;

  /** Keeps the new state of a hand and puts its toy where that state says. */
  function hand(current: Held, hold: Hold) {
    held = Option.some({ ...current, hold });
    flock.paint(current.el, hold.toy);
  }

  /** The hand that this pointer holds a toy with, if there is one. */
  function handOf(event: PointerEvent) {
    return Option.filter(held, ({ pointer }) => pointer === event.pointerId);
  }

  /** Near the top or the bottom of the window the held toy pulls the page along, frame after frame, while the hand holds it. */
  function pulling(now: number) {
    frame = 0;
    const seconds = frameSeconds(now, last);
    last = now;
    if (Option.isNone(held)) {
      return;
    }
    const { el, hold } = held.value;
    const by = carry(hold, window.innerHeight, seconds);
    if (by !== 0) {
      // A page that smooth-scrolls would lag behind the hand, so the pull is instant.
      window.scrollBy({ behavior: "instant", top: by });
      hand(held.value, follow(hold, scrollOf(), boundsOf(el)));
    }
    frame = requestAnimationFrame(pulling);
  }

  /** Ends a hold with nothing written back: the hand lets go, the toys stop, or the toy is taken out. */
  function abandon(current: Held) {
    held = Option.none();
    current.listening.abort();
    current.el.dataset.held = "false";
  }

  /**
   * Opens the hand: the toy leaves at the speed of the hand, and the page hears
   * that it was let go and, after a drag, where.
   */
  function letGo(current: Held, at: Point) {
    const toy = release(current.hold, performance.now(), isCalm());
    abandon(current);
    flock.paint(current.el, toy);
    current.heard.release?.();
    if (current.hold.dragged) {
      swallow.arm(current.root);
      current.heard.drop?.(at);
    }
    if (isMoving(toy)) {
      flock.wake();
    }
  }

  function onMove(event: PointerEvent) {
    const current = handOf(event);
    if (Option.isNone(current)) {
      return;
    }
    const { el, hold } = current.value;
    const next = drag(hold, sampleOf(event), scrollOf(), boundsOf(el));
    if (next !== hold) {
      hand(current.value, next);
      if (frame === 0) {
        last = performance.now();
        frame = requestAnimationFrame(pulling);
      }
    }
  }

  function onUp(event: PointerEvent) {
    const current = handOf(event);
    if (Option.isSome(current)) {
      letGo(current.value, { x: event.clientX, y: event.clientY });
    }
  }

  // A hold that the browser interrupted, or whose pointer capture was lost,
  // ends as an opened hand does, where the hand was last seen.
  function onLost(event: PointerEvent) {
    const current = handOf(event);
    if (Option.isSome(current)) {
      letGo(current.value, current.value.hold.point);
    }
  }

  function onScroll() {
    if (Option.isSome(held) && held.value.hold.dragged) {
      const { el, hold } = held.value;
      hand(held.value, follow(hold, scrollOf(), boundsOf(el)));
    }
  }

  return {
    /** A press on the root: the hand takes the toy it landed on, unless it holds one already. */
    press(root: HTMLElement, event: PointerEvent) {
      swallow.clear();
      const found = Option.flatMap(toyAt(root, event.target), (el) =>
        Option.map(reactionsOf(el), (heard) => ({ el, heard }))
      );
      // One toy for one pointer: a second finger does not take the toy away.
      if (Option.isSome(held) || event.button > 0 || Option.isNone(found)) {
        return;
      }
      const { el, heard } = found.value;
      const hold = grab(flock.toyOf(el), sampleOf(event), scrollOf());
      const listening = new AbortController();
      const { signal } = listening;
      held = Option.some({
        el,
        heard,
        hold,
        listening,
        pointer: event.pointerId,
        root,
      });
      flock.keep(el, hold.toy);
      raised += 1;
      el.style.zIndex = String(raised);
      el.dataset.held = "true";
      el.setPointerCapture(event.pointerId);
      window.addEventListener("pointermove", onMove, { signal });
      window.addEventListener("pointerup", onUp, { signal });
      window.addEventListener("pointercancel", onLost, { signal });
      window.addEventListener("lostpointercapture", onLost, { signal });
      window.addEventListener("scroll", onScroll, { passive: true, signal });
      heard.grab?.();
    },

    /** Changes the hold of a toy that a hand holds. Answers whether a hand did hold it. */
    withHand(el: HTMLElement, change: (hold: Hold) => Hold) {
      const hands = Option.filter(held, (current) => current.el === el);
      if (Option.isSome(hands)) {
        hand(hands.value, change(hands.value.hold));
      }
      return Option.isSome(hands);
    },

    /** Lets go of a toy that is taken out, with nothing to write back. */
    forget(el: HTMLElement) {
      if (Option.isSome(held) && held.value.el === el) {
        abandon(held.value);
      }
    },

    /** Lets go of any toy in the hand, and ends the wait for a click. */
    stop() {
      cancelAnimationFrame(frame);
      frame = 0;
      swallow.clear();
      if (Option.isSome(held)) {
        abandon(held.value);
      }
    },
  };
}
