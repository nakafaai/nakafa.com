import { afterEach, describe, expect, it } from "@effect/vitest";
import { Effect, MutableHashMap, Option } from "effect";
import { KeyValueStore } from "effect/persistence";
import { keptStorage } from "@/components/player/storage";

/** A browser's local storage that keeps its values in a table, as a page's storage does. */
function memoryStorage() {
  const values = MutableHashMap.empty<string, string>();
  return {
    clear: () => MutableHashMap.clear(values),
    getItem: (key: string) => Option.getOrNull(MutableHashMap.get(values, key)),
    get length() {
      return MutableHashMap.size(values);
    },
    removeItem: (key: string) => {
      MutableHashMap.remove(values, key);
    },
    setItem: (key: string, value: string) => {
      MutableHashMap.set(values, key, value);
    },
  };
}

/** The error that a program fails with on the browser's storage, which the test reads. */
const failureOf = <A>(
  program: Effect.Effect<
    A,
    KeyValueStore.KeyValueStoreError,
    KeyValueStore.KeyValueStore
  >
) => program.pipe(Effect.provide(keptStorage), Effect.flip);

describe("keptStorage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.effect("keeps values in the browser's local storage across calls", () =>
    Effect.gen(function* () {
      vi.stubGlobal("localStorage", memoryStorage());
      const store = yield* KeyValueStore.KeyValueStore;
      yield* store.set("kept", "answer");
      const size = yield* store.size;
      const value = yield* store.get("kept");
      const missing = yield* store.get("absent");
      yield* store.remove("kept");
      const removed = yield* store.get("kept");
      yield* store.set("other", "text");
      yield* store.clear;
      expect({ missing, removed, size, value }).toEqual({
        missing: undefined,
        removed: undefined,
        size: 1,
        value: "answer",
      });
    }).pipe(Effect.provide(keptStorage))
  );

  it.effect("names the key of a read that the browser refuses", () =>
    Effect.gen(function* () {
      vi.stubGlobal("localStorage", {
        ...memoryStorage(),
        getItem: () => {
          throw new Error("quota");
        },
      });
      const error = yield* failureOf(
        Effect.flatMap(KeyValueStore.KeyValueStore, (store) =>
          store.get("kept")
        )
      );
      expect(error).toMatchObject({
        _tag: "KeyValueStoreError",
        key: "kept",
        method: "get",
      });
    })
  );

  it.effect(
    "names the call that the browser refuses when it takes no key",
    () =>
      Effect.gen(function* () {
        vi.stubGlobal("localStorage", {
          ...memoryStorage(),
          clear: () => {
            throw new Error("denied");
          },
        });
        const error = yield* failureOf(
          Effect.flatMap(KeyValueStore.KeyValueStore, (store) => store.clear)
        );
        expect(error).toMatchObject({
          _tag: "KeyValueStoreError",
          method: "clear",
        });
        expect(error).not.toHaveProperty("key");
      })
  );

  it.effect(
    "fails to open when the browser refuses its storage altogether",
    () =>
      Effect.gen(function* () {
        Object.defineProperty(globalThis, "localStorage", {
          configurable: true,
          get: () => {
            throw new Error("blocked");
          },
        });
        const error = yield* failureOf(
          Effect.flatMap(KeyValueStore.KeyValueStore, (store) => store.size)
        );
        expect(error).toMatchObject({
          _tag: "KeyValueStoreError",
          method: "open",
        });
        Reflect.deleteProperty(globalThis, "localStorage");
      })
  );
});
