"use client";

import { useRequired } from "@repo/design-system/hooks/required";
import { Option } from "effect";
import type { startSound } from "@/components/island/mixer";
import type { GameStoreApi } from "@/components/island/store";
import { GameStoreContext } from "@/components/island/store";

/** How often the mix is moved on, in milliseconds: often enough that a loop's next round is always laid in time. */
const TICK = 250;

/**
 * Starts the world's sound at the learner's first press or key, and gives
 * back what ends it. Nothing of the sound is loaded before that: not its
 * code, which holds the HTTP client that reads the recordings, and no
 * recording (ADR 0050, W8). Every change of the game's store is heard once
 * its action is over, so an action that writes the store twice, as an undo
 * does, sounds once.
 */
function attach(store: GameStoreApi) {
  let sound = Option.none<ReturnType<typeof startSound>>();
  let asked = false;
  let closed = false;
  let queued = false;
  const begin = () => {
    Option.map(sound, (playing) => playing.wake());
    if (asked) {
      return;
    }
    asked = true;
    import("@/components/island/mixer").then(
      (mixer) => {
        if (!closed) {
          sound = Option.some(mixer.startSound(store));
        }
      },
      () => {
        // The code did not arrive, as with no network: the next press asks again.
        asked = false;
      }
    );
  };
  const flush = () => {
    queued = false;
    Option.map(sound, (playing) => playing.hear());
  };
  const unsubscribe = store.subscribe(() => {
    if (!queued) {
      queued = true;
      queueMicrotask(flush);
    }
  });
  const ticking = window.setInterval(
    () => Option.map(sound, (playing) => playing.tick()),
    TICK
  );
  const seen = () =>
    Option.map(sound, (playing) =>
      document.hidden ? playing.rest() : playing.wake()
    );
  window.addEventListener("pointerdown", begin);
  window.addEventListener("keydown", begin);
  document.addEventListener("visibilitychange", seen);
  return () => {
    closed = true;
    unsubscribe();
    window.clearInterval(ticking);
    window.removeEventListener("pointerdown", begin);
    window.removeEventListener("keydown", begin);
    document.removeEventListener("visibilitychange", seen);
    Option.map(sound, (playing) => playing.stop());
  };
}

/** Starts the world's sound at the learner's first press, and stops it when the game closes. */
export function IslandSound() {
  const store = useRequired(GameStoreContext, "IslandSound");
  return (
    <span
      hidden
      ref={(node) => {
        if (node === null) {
          return;
        }
        return attach(store);
      }}
    />
  );
}
