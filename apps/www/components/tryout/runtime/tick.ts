import { Array as Arr, MutableHashSet } from "effect";

/**
 * Calls each subscribed listener once per tick, in subscription order. A listener removed earlier in the tick is skipped. A listener added during a tick is first called on the next tick (on main it was called in the same tick).
 */
export function notifyTickListeners(
  listeners: MutableHashSet.MutableHashSet<() => void>
) {
  for (const listener of Arr.fromIterable(listeners)) {
    if (MutableHashSet.has(listeners, listener)) {
      listener();
    }
  }
}
