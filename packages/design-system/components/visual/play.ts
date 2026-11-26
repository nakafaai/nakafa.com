import { Schema } from "effect";
import type { StoreApi } from "zustand";

/**
 * What a card's scene reads: whether it plays, how many times playback was
 * stopped and rewound, and how many times the learner asked for its first view
 * back. A scene starts still, at its first view.
 */
const VisualPlaySchema = Schema.Struct({
  playing: Schema.Boolean,
  stopCount: Schema.Int,
  view: Schema.Int,
});

type VisualPlay = typeof VisualPlaySchema.Type;

/** A scene that stands still at its first view. */
export const STILL: VisualPlay = { playing: false, stopCount: 0, view: 0 };

/**
 * The card's scene actions, which its play, pause, stop, and reset buttons call
 * and its camera and timelines follow. They run in the card's store, which
 * holds `STILL`'s fields.
 */
export function playActions(set: StoreApi<VisualPlay>["setState"]) {
  return {
    /** Stops the scene moving by itself, such as when a learner scrubs a slider. */
    pause: () => set({ playing: false }),
    /** Starts the scene moving by itself, as an animation does once it first shows. */
    play: () => set({ playing: true }),
    /** Stops playback, rewinds animations, and returns the camera and controls to defaults. */
    reset: () =>
      set((current) => ({
        playing: false,
        stopCount: current.stopCount + 1,
        view: current.view + 1,
      })),
    /** Takes the scene back to its first view, and keeps it playing if it played. */
    resetView: () => set((current) => ({ view: current.view + 1 })),
    /** Stops playback and rewinds animations to their start frame without moving the camera. */
    stop: () =>
      set((current) => ({
        playing: false,
        stopCount: current.stopCount + 1,
      })),
    /** Starts the scene moving by itself, or pauses it. */
    togglePlaying: () => set((current) => ({ playing: !current.playing })),
  };
}
