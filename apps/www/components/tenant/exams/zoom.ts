import { Effect, Option, Schema } from "effect";
import { KeyValueStore } from "effect/persistence";

/** The smallest zoom of the pages, in percent of their size. */
export const ZOOM_MIN = 50;

/** The largest zoom of the pages, in percent of their size. */
export const ZOOM_MAX = 200;

/** The zoom of the pages before the teacher chooses one, in percent. */
export const ZOOM_DEFAULT = 100;

/** The steps of the zoom slider, from its first position to its last. */
export const ZOOM_STEPS = 1000;

/** The key under which the zoom of the editor is remembered for this viewer. */
export const ZOOM_KEY = "nakafa.exam-editor.zoom";

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

/**
 * Reads the zoom the viewer chose. A zoom that is not stored, or stored as something that is not a
 * zoom in range, reads as the default, so the pages always draw a zoom the editor allows.
 */
export const readZoom = Effect.gen(function* () {
  const store = KeyValueStore.toSchemaStore(
    yield* KeyValueStore.KeyValueStore,
    ZoomPercent
  );
  const stored = yield* store
    .get(ZOOM_KEY)
    .pipe(Effect.orElseSucceed(() => Option.none<number>()));
  return Option.getOrElse(stored, () => ZOOM_DEFAULT);
});

/**
 * Remembers the zoom the viewer chose. A store that refuses the write keeps the zoom for this
 * visit only, and the editor draws the zoom the viewer chose either way.
 */
export const writeZoom = (percent: number) =>
  Effect.gen(function* () {
    const store = KeyValueStore.toSchemaStore(
      yield* KeyValueStore.KeyValueStore,
      ZoomPercent
    );
    yield* store.set(ZOOM_KEY, percent).pipe(Effect.ignore);
  });
