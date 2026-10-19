import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { KeyValueStore } from "effect/persistence";
import {
  createExamZoom,
  readZoom,
  sliderPosition,
  writeZoom,
  ZOOM_DEFAULT,
  ZOOM_KEY,
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_STEPS,
  zoomAt,
} from "@/components/tenant/exams/zoom";

/** The answer of a store that holds no value for the key. */
const nothingStored = (): string | undefined => undefined;

/** A store that holds nothing, which a test overrides in the one operation it exercises. */
const storeWith = (
  overrides: Partial<Pick<KeyValueStore.MakeStringOptions, "get" | "set">>
) =>
  KeyValueStore.makeStringOnly({
    clear: Effect.void,
    get: () => Effect.sync(nothingStored),
    has: () => Effect.succeed(false),
    isEmpty: Effect.succeed(true),
    remove: () => Effect.void,
    set: () => Effect.void,
    size: Effect.succeed(0),
    ...overrides,
  });

it("spans the zoom from its smallest to its largest value", () => {
  expect(zoomAt(0)).toBe(ZOOM_MIN);
  expect(zoomAt(ZOOM_STEPS)).toBe(ZOOM_MAX);
});

it("keeps the nearest zoom for a slider position past either end", () => {
  expect(zoomAt(-5)).toBe(ZOOM_MIN);
  expect(zoomAt(ZOOM_STEPS + 5)).toBe(ZOOM_MAX);
});

it("maps a zoom to a slider position and back to the same zoom", () => {
  for (const percent of [50, 75, ZOOM_DEFAULT, 150, 200]) {
    expect(zoomAt(sliderPosition(percent))).toBe(percent);
  }
});

it("starts the pages at the default zoom, and takes a new zoom at once", () => {
  const zoom = createExamZoom();
  expect(zoom.getState().percent).toBe(ZOOM_DEFAULT);

  zoom.getState().set(150);
  expect(zoom.getState().percent).toBe(150);
});

it("spaces the zoom on a logarithmic scale, so each step scales the pages alike", () => {
  expect(zoomAt(ZOOM_STEPS / 2)).toBe(
    Math.round(Math.sqrt(ZOOM_MIN * ZOOM_MAX))
  );
});

it.effect("reads the default when no zoom is stored", () =>
  Effect.gen(function* () {
    const zoom = yield* readZoom();

    expect(zoom).toBe(ZOOM_DEFAULT);
  }).pipe(Effect.provide(KeyValueStore.layerMemory))
);

it.effect("reads back the zoom that was written", () =>
  Effect.gen(function* () {
    yield* writeZoom(150);
    const zoom = yield* readZoom();

    expect(zoom).toBe(150);
  }).pipe(Effect.provide(KeyValueStore.layerMemory))
);

it.effect("reads the default when the stored zoom is out of range", () =>
  Effect.gen(function* () {
    const store = yield* KeyValueStore.KeyValueStore;
    yield* store.set(ZOOM_KEY, "999");
    const zoom = yield* readZoom();

    expect(zoom).toBe(ZOOM_DEFAULT);
  }).pipe(Effect.provide(KeyValueStore.layerMemory))
);

it.effect("reads the default when the stored value is not JSON", () =>
  Effect.gen(function* () {
    const store = yield* KeyValueStore.KeyValueStore;
    yield* store.set(ZOOM_KEY, "not json");
    const zoom = yield* readZoom();

    expect(zoom).toBe(ZOOM_DEFAULT);
  }).pipe(Effect.provide(KeyValueStore.layerMemory))
);

it.effect("reads the default when the store cannot be read", () =>
  Effect.gen(function* () {
    const zoom = yield* readZoom();

    expect(zoom).toBe(ZOOM_DEFAULT);
  }).pipe(
    Effect.provideService(
      KeyValueStore.KeyValueStore,
      storeWith({
        get: () =>
          Effect.fail(
            new KeyValueStore.KeyValueStoreError({
              method: "get",
              message: "storage is blocked",
            })
          ),
      })
    )
  )
);

it.effect("completes without a failure when the store refuses the write", () =>
  writeZoom(120).pipe(
    Effect.provideService(
      KeyValueStore.KeyValueStore,
      storeWith({
        set: () =>
          Effect.fail(
            new KeyValueStore.KeyValueStoreError({
              method: "set",
              message: "storage is full",
            })
          ),
      })
    )
  )
);
