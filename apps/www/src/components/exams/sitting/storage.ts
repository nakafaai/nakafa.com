import { Effect, Layer } from "effect";
import { KeyValueStore } from "effect/persistence";

/**
 * The failure of one call to the browser's local storage, which names the call that the browser refused
 * and the key that it was given, when the call takes one.
 */
const storageFailure = (method: string, key?: string) => (cause: unknown) =>
  new KeyValueStore.KeyValueStoreError({
    cause,
    message: `The browser refused the local storage call ${method}.`,
    method,
    ...(key === undefined ? {} : { key }),
  });

/**
 * The browser's local storage as an Effect key-value store, which keeps a student's unsent answers and
 * flags on this device across reloads. It is the layer that `@effect/platform-browser` names
 * `layerLocalStorage` in Effect 4.0.5, written here so the web app needs no further package. A browser
 * that refuses its storage fails the store's calls with a `KeyValueStoreError`, so the caller reports it
 * and the page still answers.
 */
export const sittingStorage = Layer.effect(KeyValueStore.KeyValueStore)(
  Effect.map(
    Effect.try({
      catch: storageFailure("open"),
      try: () => globalThis.localStorage,
    }),
    (storage) =>
      KeyValueStore.makeStringOnly({
        clear: Effect.try({
          catch: storageFailure("clear"),
          try: () => storage.clear(),
        }),
        get: (key) =>
          Effect.try({
            catch: storageFailure("get", key),
            try: () => storage.getItem(key) ?? undefined,
          }),
        remove: (key) =>
          Effect.try({
            catch: storageFailure("remove", key),
            try: () => storage.removeItem(key),
          }),
        set: (key, value) =>
          Effect.try({
            catch: storageFailure("set", key),
            try: () => storage.setItem(key, value),
          }),
        size: Effect.try({
          catch: storageFailure("size"),
          try: () => storage.length,
        }),
      })
  )
);
