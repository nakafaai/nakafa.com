import { Schema } from "effect";
import type { StoreApi } from "zustand";

/**
 * What a card's scene reads: whether it plays, and how many times the learner
 * asked for its first view back. A scene starts still, at its first view.
 */
const VisualPlaySchema = Schema.Struct({
  playing: Schema.Boolean,
  view: Schema.Int,
});

type VisualPlay = typeof VisualPlaySchema.Type;

/** A scene that stands still at its first view. */
export const STILL: VisualPlay = { playing: false, view: 0 };

/**
 * The card's scene actions, which its play and reset buttons call and its
 * camera follows. They run in the card's store, which holds `STILL`'s fields.
 */
export function playActions(set: StoreApi<VisualPlay>["setState"]) {
  return {
    /** Takes the scene back to its first view, and keeps it playing if it played. */
    resetView: () => set((current) => ({ view: current.view + 1 })),
    /** Starts the scene moving by itself, or stops it. */
    togglePlaying: () => set((current) => ({ playing: !current.playing })),
  };
}
