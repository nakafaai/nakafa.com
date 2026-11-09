import { Option } from "effect";
import { createStore } from "zustand";
import type { Cue } from "@/lib/island/music";

/**
 * The sound of one island frame (ADR 0042, D19, D26): the audio context the
 * owner's first press opened, whether they turned sound off, and the last cue a
 * press asked for, counted so the same cue twice plays twice. The store keeps
 * the context as it is given; it never plays anything itself.
 */
export function createSoundStore<Context>(muted: boolean) {
  return createStore<{
    readonly context: Option.Option<Context>;
    readonly cue: Option.Option<{ readonly count: number; readonly name: Cue }>;
    readonly muted: boolean;
    /** Keeps the first context opened; a later one is left alone. */
    open: (context: Context) => void;
    /** Asks for a cue, which the frame's audio plays while sound is on. */
    play: (name: Cue) => void;
    /** Turns sound off, or on again. */
    toggle: () => void;
  }>((set, get) => ({
    context: Option.none(),
    cue: Option.none(),
    muted,
    open: (context) => {
      if (Option.isNone(get().context)) {
        set({ context: Option.some(context) });
      }
    },
    play: (name) =>
      set({
        cue: Option.some({
          count: Option.match(get().cue, {
            onNone: () => 1,
            onSome: (last) => last.count + 1,
          }),
          name,
        }),
      }),
    toggle: () => set({ muted: !get().muted }),
  }));
}
