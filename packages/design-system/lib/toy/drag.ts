import {
  boundsOf,
  swallowClick,
  TOY_ATTRIBUTE,
  toyAt,
} from "@repo/design-system/lib/toy/dom";
import {
  type Bounds,
  frameSeconds,
  homeward,
  isMoving,
  type Point,
  REST,
  step,
  type Toy,
  transformOf,
} from "@repo/design-system/lib/toy/flight";
import {
  carry,
  drag,
  follow,
  grab,
  type Hold,
  release,
} from "@repo/design-system/lib/toy/hand";
import { Array as Arr, Equal, MutableHashMap, Option } from "effect";

const CALM = "(prefers-reduced-motion: reduce)";
/** The layer a toy first rises to when it is taken. Each toy taken rises above the last. */
const FIRST_LAYER = 10;

/** What a toy tells its page: taken, let go, and, after a drag, where the hand let go. */
interface Reactions {
  drop?: (point: Point) => void;
  grab?: () => void;
  release?: () => void;
}

/** The toy in a hand: its element, the hand, the listeners that exist only for this hold, and the pointer that holds it. */
interface Held {
  el: HTMLElement;
  hold: Hold;
  listening: AbortController;
  pointer: number;
  root: HTMLElement;
}

function sample(event: PointerEvent) {
  return { t: performance.now(), x: event.clientX, y: event.clientY };
}

function scrolled() {
  return { x: window.scrollX, y: window.scrollY };
}

/** A person who asked for less motion gets no throw and no spring. */
function isCalm() {
  return window.matchMedia(CALM).matches;
}

/**
 * Makes toys of the elements given to `add`: a person can pick one up, throw
 * it, and leave it where it lands. It follows the hand from the point where it
 * was taken, stays inside its positioned parent, and answers to one pointer at
 * a time. A press that does not move is still a click, and a drag is not one.
 * A held toy follows the page when it scrolls, and near the top or bottom of
 * the window it pulls the page along, so it can be carried across a page.
 *
 * Nothing listens until a toy is taken: a root holds one press listener, and
 * the pointer, the scroll and the frames exist only while a hand holds a toy.
 * Creating the toys touches no page; `attach` starts them on a root.
 */
export function createToys() {
  // Only a toy that was moved has a state. Every other toy lies at its place.
  const states = MutableHashMap.empty<HTMLElement, Toy>();
  const reactions = MutableHashMap.empty<HTMLElement, Reactions>();
  let held = Option.none<Held>();
  // The listener that swallows the click which follows a drag, until the next press.
  let swallowing = Option.none<AbortController>();
  let frame = 0;
  let last = 0;
  let raised = FIRST_LAYER;

  function toyOf(el: HTMLElement) {
    return Option.getOrElse(MutableHashMap.get(states, el), () => REST);
  }

  /** Tells the page about a toy, when the toy was added to hear of it. */
  function tell(el: HTMLElement, news: (heard: Reactions) => void) {
    Option.map(MutableHashMap.get(reactions, el), news);
  }

  /** Records where a toy is and puts it there. */
  function paint(el: HTMLElement, toy: Toy) {
    MutableHashMap.set(states, el, toy);
    el.style.transform = transformOf(toy);
  }

  /** Keeps the new state of a hand and puts its toy where that state says. */
  function hand(current: Held, hold: Hold) {
    held = Option.some({ ...current, hold });
    paint(current.el, hold.toy);
  }

  /** The hand that this pointer holds a toy with, if there is one. */
  function handOf(event: PointerEvent) {
    return Option.filter(held, ({ pointer }) => pointer === event.pointerId);
  }

  /** Runs the frames until every toy has stopped and no hand holds one. */
  function wake() {
    if (frame === 0) {
      last = performance.now();
      frame = requestAnimationFrame(tick);
    }
  }

  /** Pulls the page along when the hand holds its toy near the top or the bottom of the window. */
  function pull(current: Held, bounds: Option.Option<Bounds>, seconds: number) {
    const by = carry(current.hold, window.innerHeight, seconds);
    if (by !== 0) {
      // A page that smooth-scrolls would lag behind the hand, so the pull is instant.
      window.scrollBy({ behavior: "instant", top: by });
      hand(current, follow(current.hold, scrolled(), bounds));
    }
  }

  function tick(now: number) {
    frame = 0;
    const seconds = frameSeconds(now, last);
    last = now;
    // Every wall is read before any toy is moved, so the page lays out once.
    const flying = Arr.map(
      Arr.filter(
        Arr.fromIterable(states),
        ([, toy]) => toy.mode !== "held" && isMoving(toy)
      ),
      ([el, toy]) => ({
        bounds: toy.mode === "home" ? Option.none<Bounds>() : boundsOf(el),
        el,
        toy,
      })
    );
    const holding = Option.map(held, (current) => ({
      bounds: boundsOf(current.el),
      current,
    }));
    const stepped = Arr.map(flying, ({ bounds, el, toy }) => {
      const next = step(toy, seconds, bounds);
      paint(el, next);
      return next;
    });
    Option.map(holding, ({ bounds, current }) =>
      pull(current, bounds, seconds)
    );
    if (Option.isSome(held) || Arr.some(stepped, isMoving)) {
      frame = requestAnimationFrame(tick);
    }
  }

  /** Lets go of the toy in the hand, and tells the page where, after a drag. */
  function finish(
    current: Held,
    toy: Toy,
    dropped: Option.Option<PointerEvent>
  ) {
    held = Option.none();
    current.listening.abort();
    current.el.dataset.held = "false";
    paint(current.el, toy);
    tell(current.el, (heard) => heard.release?.());
    if (current.hold.dragged) {
      swallowing = Option.some(swallowClick(current.root));
      Option.map(dropped, ({ clientX, clientY }) =>
        tell(current.el, (heard) => heard.drop?.({ x: clientX, y: clientY }))
      );
    }
    if (isMoving(toy)) {
      wake();
    }
  }

  function onMove(event: PointerEvent) {
    Option.map(handOf(event), (current) => {
      const { el, hold } = current;
      const next = drag(hold, sample(event), scrolled(), boundsOf(el));
      if (next !== hold) {
        hand(current, next);
        wake();
      }
    });
  }

  function onUp(event: PointerEvent) {
    Option.map(handOf(event), (current) => {
      const toy = release(current.hold, performance.now(), isCalm());
      finish(current, toy, Option.some(event));
    });
  }

  // A hold that was interrupted, not ended by the hand, throws nothing.
  function onCancel(event: PointerEvent) {
    Option.map(handOf(event), (current) => {
      finish(current, release(current.hold, 0, true), Option.none());
    });
  }

  function onScroll() {
    Option.map(
      Option.filter(held, ({ hold }) => hold.dragged),
      (current) => {
        const { el, hold } = current;
        hand(current, follow(hold, scrolled(), boundsOf(el)));
      }
    );
  }

  function onPress(root: HTMLElement, event: PointerEvent) {
    Option.map(swallowing, (swallow) => swallow.abort());
    swallowing = Option.none();
    const found = toyAt(root, event.target);
    // One toy for one pointer: a second finger does not take the toy away.
    if (Option.isSome(held) || event.button > 0 || Option.isNone(found)) {
      return;
    }
    const el = found.value;
    const hold = grab(toyOf(el), sample(event), scrolled());
    const listening = new AbortController();
    const { signal } = listening;
    held = Option.some({ el, hold, listening, pointer: event.pointerId, root });
    MutableHashMap.set(states, el, hold.toy);
    raised += 1;
    el.style.zIndex = String(raised);
    el.dataset.held = "true";
    el.setPointerCapture(event.pointerId);
    window.addEventListener("pointermove", onMove, { signal });
    window.addEventListener("pointerup", onUp, { signal });
    window.addEventListener("pointercancel", onCancel, { signal });
    window.addEventListener("lostpointercapture", onCancel, { signal });
    window.addEventListener("scroll", onScroll, { passive: true, signal });
    tell(el, (heard) => heard.grab?.());
  }

  return {
    /**
     * Makes an element a toy, and tells what it should tell its page. Returns
     * what takes the toy out again and forgets where it was left.
     */
    add(el: HTMLElement, heard: Reactions) {
      // Effect compares an object by what it holds, and an element holds nothing
      // it can see: toys are compared by reference.
      Equal.byReferenceUnsafe(el);
      el.setAttribute(TOY_ATTRIBUTE, "");
      MutableHashMap.set(reactions, el, heard);
      return () => {
        el.removeAttribute(TOY_ATTRIBUTE);
        MutableHashMap.remove(reactions, el);
        MutableHashMap.remove(states, el);
      };
    },

    /** Starts the toys on `root`. Returns what stops them and lets go of any toy in a hand. */
    attach(root: HTMLElement) {
      const listening = new AbortController();
      root.addEventListener("pointerdown", (event) => onPress(root, event), {
        passive: true,
        signal: listening.signal,
      });
      return () => {
        listening.abort();
        cancelAnimationFrame(frame);
        frame = 0;
        Option.map(swallowing, (swallow) => swallow.abort());
        swallowing = Option.none();
        Option.map(held, (current) => {
          current.listening.abort();
          current.el.dataset.held = "false";
        });
        held = Option.none();
      };
    },

    /** Sends a toy back to its place on a soft spring, at once for a person who asked for less motion. */
    home(el: HTMLElement) {
      const next = homeward(toyOf(el), isCalm());
      paint(el, next);
      if (isMoving(next)) {
        wake();
      }
    },

    /** Puts a toy back on its place at once, with no motion. */
    rest(el: HTMLElement) {
      MutableHashMap.remove(states, el);
      el.style.transform = transformOf(REST);
    },
  };
}
