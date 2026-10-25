import { Schema } from "effect";
import { createStore } from "zustand";

/** The smallest zoom of the pages, in percent of their size. */
export const ZOOM_MIN = 50;

/** The largest zoom of the pages, in percent of their size. */
export const ZOOM_MAX = 200;

/** The zoom of the pages before the teacher chooses one, in percent. */
export const ZOOM_DEFAULT = 100;

/** The steps of the zoom slider, from its first position to its last. */
export const ZOOM_STEPS = 1000;

/** A zoom the viewer may choose, in whole percent, as the store keeps it. */
const ZoomPercent = Schema.Int.check(
  Schema.isBetween({ minimum: ZOOM_MIN, maximum: ZOOM_MAX })
);

/** The span of the zoom on a logarithmic scale, so each step of the slider scales the pages alike. */
const LOG_SPAN = Math.log(ZOOM_MAX) - Math.log(ZOOM_MIN);

/** The slider position of a zoom, from 0 at the smallest zoom to `ZOOM_STEPS` at the largest. */
export const sliderPosition = (percent: number): number =>
  Math.round(
    ((Math.log(percent) - Math.log(ZOOM_MIN)) / LOG_SPAN) * ZOOM_STEPS
  );

/**
 * The zoom of a slider position, in whole percent. A position past either end keeps the nearest
 * zoom, so a value the slider never sends still draws a zoom the editor allows.
 */
export const zoomAt = (position: number): number => {
  const fraction = Math.min(Math.max(position, 0), ZOOM_STEPS) / ZOOM_STEPS;
  return Math.round(ZOOM_MIN * Math.exp(fraction * LOG_SPAN));
};

/** The zoom of one editor's pages, as the viewer chose it on this visit, with the action that changes it. */
const ZoomState = Schema.Struct({ percent: ZoomPercent });

/** The state of one editor's zoom, with its action. */
export type ExamZoom = typeof ZoomState.Type & {
  /** Shows a new zoom at once. */
  readonly set: (percent: typeof ZoomPercent.Type) => void;
};

/**
 * Creates the zoom of one editor. The pages start at the default on every visit, and the viewer's
 * change lasts that visit. A zoom is not stored between visits: a stored zoom is read after the first
 * paint, so the pages would change size once the page loads.
 */
export const createExamZoom = () =>
  createStore<ExamZoom>()((set) => ({
    percent: ZOOM_DEFAULT,
    set: (percent) => set({ percent }),
  }));
