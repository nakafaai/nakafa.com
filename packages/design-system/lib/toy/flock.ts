import { isCalm } from "@repo/design-system/lib/calm";
import { boundsOf } from "@repo/design-system/lib/toy/dom";
import {
  frameSeconds,
  homeward,
  isMoving,
  REST,
  step,
  type Toy,
  transformOf,
} from "@repo/design-system/lib/toy/flight";
import { Array as Arr, Equal, MutableHashMap, Option } from "effect";

/**
 * The toys of a page that no hand holds: where each of them lies, and the
 * frames that carry the ones that fly or go home until they have stopped. Only
 * a toy that was moved has a state; every other toy lies at its place.
 */
export function createFlock() {
  // Effect compares an object by what it holds, and an element holds nothing
  // it can see: toys are compared by reference.
  const states = MutableHashMap.empty<HTMLElement, Toy>();
  let frame = 0;
  let last = 0;

  function toyOf(el: HTMLElement) {
    return Option.getOrElse(
      MutableHashMap.get(states, Equal.byReferenceUnsafe(el)),
      () => REST
    );
  }

  /** Records where a toy is without moving it: a hand takes a toy as it lies. */
  function keep(el: HTMLElement, toy: Toy) {
    MutableHashMap.set(states, Equal.byReferenceUnsafe(el), toy);
  }

  /** Forgets where a toy was left. */
  function forget(el: HTMLElement) {
    MutableHashMap.remove(states, Equal.byReferenceUnsafe(el));
  }

  /** Records where a toy is and puts it there. */
  function paint(el: HTMLElement, toy: Toy) {
    keep(el, toy);
    el.style.transform = transformOf(toy);
  }

  /** Runs the frames until every toy has stopped. */
  function wake() {
    if (frame === 0) {
      last = performance.now();
      frame = requestAnimationFrame(tick);
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
        bounds: toy.mode === "home" ? Option.none() : boundsOf(el),
        el,
        toy,
      })
    );
    const stepped = Arr.map(flying, (flier) => {
      const next = step(flier.toy, seconds, flier.bounds);
      paint(flier.el, next);
      return next;
    });
    if (Arr.some(stepped, isMoving)) {
      frame = requestAnimationFrame(tick);
    }
  }

  return {
    forget,
    keep,
    paint,
    toyOf,
    wake,

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
      forget(el);
      el.style.transform = transformOf(REST);
    },

    /** Drops the frame that was asked for. */
    stop() {
      cancelAnimationFrame(frame);
      frame = 0;
    },
  };
}
