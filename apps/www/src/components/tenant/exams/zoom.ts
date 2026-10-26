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

/** The zooms the percentage menu offers, from the largest to the smallest, as a design tool lists them. */
export const ZOOM_PRESETS = [200, 150, 100, 75, 50] as const;

/**
 * How the pages take their size: `fit` draws each page at its own width, narrowed to the canvas when the
 * canvas is narrower, which the server draws too; `fill` stretches the pages to the canvas's whole width;
 * and `percent` draws them at the zoom the teacher chose on the slider or in the menu.
 */
export const ZoomMode = Schema.Literals(["fit", "fill", "percent"]);

/** The width of the column of pages at the default zoom, as `max-w-3xl` draws it, which Fill stretches. */
export const PAGE_WIDTH = 768;

/**
 * The zoom of one editor's pages, as the viewer chose it on this visit, and `canvasWidth`, the width the
 * pages may fill in the canvas, which the canvas measures while Fill is chosen and which is 0 otherwise.
 */
const ZoomState = Schema.Struct({
  canvasWidth: Schema.Finite,
  mode: ZoomMode,
  percent: ZoomPercent,
});

/** The state of one editor's zoom, with its actions. */
export type ExamZoom = typeof ZoomState.Type & {
  /** Fits or fills the pages to the canvas, whatever zoom it then takes. */
  readonly fit: (mode: "fill" | "fit") => void;
  /** Takes the width the canvas measured for Fill. */
  readonly measure: (canvasWidth: number) => void;
  /** Shows a new zoom at once. */
  readonly set: (percent: typeof ZoomPercent.Type) => void;
};

/**
 * Creates the zoom of one editor. The pages start fitted on every visit, which draws them as the server
 * does, and the viewer's change lasts that visit. A zoom is not stored between visits: a stored zoom is
 * read after the first paint, so the pages would change size once the page loads.
 */
export const createExamZoom = () =>
  createStore<ExamZoom>()((set) => ({
    canvasWidth: 0,
    fit: (mode) => set({ mode }),
    measure: (canvasWidth) => set({ canvasWidth }),
    mode: "fit",
    percent: ZOOM_DEFAULT,
    set: (percent) => set({ mode: "percent", percent }),
  }));

/**
 * The zoom the pages are drawn at, in whole percent. Fit draws the pages at their own width; fill stretches
 * them to the measured `canvasWidth` against `PAGE_WIDTH`, the width they take at the default zoom; and
 * percent keeps the chosen zoom. Fill stays within the zooms the editor allows, and it draws at the default
 * zoom until the canvas is measured.
 */
export const drawnZoom = (
  zoom: Pick<typeof ZoomState.Type, "canvasWidth" | "mode" | "percent">
): number => {
  if (zoom.mode === "fit") {
    return ZOOM_DEFAULT;
  }
  if (zoom.mode === "percent") {
    return zoom.percent;
  }
  if (zoom.canvasWidth <= 0) {
    return ZOOM_DEFAULT;
  }
  return Math.min(
    Math.max(Math.floor((zoom.canvasWidth / PAGE_WIDTH) * ZOOM_DEFAULT), ZOOM_MIN),
    ZOOM_MAX
  );
};
