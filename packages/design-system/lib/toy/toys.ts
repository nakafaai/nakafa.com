import { TOY_ATTRIBUTE } from "@repo/design-system/lib/toy/dom";
import { createDrag, type Reactions } from "@repo/design-system/lib/toy/drag";
import { createFlock } from "@repo/design-system/lib/toy/flock";
import { sendHome, still } from "@repo/design-system/lib/toy/hand";
import { Equal, MutableHashMap } from "effect";

/**
 * Makes toys of the elements given to `add`: a person can pick one up, throw
 * it, and leave it where it lands inside its positioned parent. The hand that
 * holds a toy is `createDrag`, the toys that lie or fly are `createFlock`.
 *
 * Nothing listens until a toy is taken: a root holds one press listener, and
 * the pointer, the scroll and the frames exist only while a hand holds a toy.
 * Creating the toys touches no page; `attach` starts them on a root.
 */
export function createToys() {
  const reactions = MutableHashMap.empty<HTMLElement, Reactions>();
  const flock = createFlock();
  const hand = createDrag(flock, (el) => MutableHashMap.get(reactions, el));

  return {
    /**
     * Makes an element a toy, and tells what it should tell its page. Returns
     * what takes the toy out again and forgets where it was left. A hand that
     * still holds it lets go with nothing to write back.
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
        flock.forget(el);
        hand.forget(el);
      };
    },

    /** Starts the toys on `root`. Returns what stops them and lets go of any toy in a hand. */
    attach(root: HTMLElement) {
      const listening = new AbortController();
      root.addEventListener("pointerdown", (event) => hand.press(root, event), {
        passive: true,
        signal: listening.signal,
      });
      return () => {
        listening.abort();
        flock.stop();
        hand.stop();
      };
    },

    /** Sends a toy back to its place on a soft spring, at once for a person who asked for less motion. A toy in a hand goes when the hand lets go. */
    home(el: HTMLElement) {
      if (!hand.withHand(el, sendHome)) {
        flock.home(el);
      }
    },

    /** Puts a toy back on its place at once, with no motion. A toy in a hand keeps its place under it, upright. */
    rest(el: HTMLElement) {
      if (!hand.withHand(el, still)) {
        flock.rest(el);
      }
    },
  };
}
