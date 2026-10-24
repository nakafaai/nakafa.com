import { Array as Arr, MutableHashMap, Option, Schema } from "effect";

/** One value that the test store keeps, with its tags and its end of life. */
const TestEntrySchema = Schema.Struct({
  expiresAt: Schema.Finite,
  tags: Schema.Array(Schema.String),
  value: Schema.Unknown,
});
type TestEntry = typeof TestEntrySchema.Type;

/**
 * A stand-in for the isolate's content store. It mirrors the store's contract
 * without importing it, because a test mocks the store's module and this file
 * must still load.
 */
function makeTestStore() {
  const entries = MutableHashMap.empty<string, TestEntry>();
  return {
    expireTag(tag: string) {
      for (const [key, entry] of Arr.fromIterable(entries)) {
        if (Arr.contains(entry.tags, tag)) {
          MutableHashMap.remove(entries, key);
        }
      }
    },
    get(key: string, now: number) {
      return Option.flatMap(MutableHashMap.get(entries, key), (entry) =>
        entry.expiresAt > now ? Option.some(entry.value) : Option.none()
      );
    },
    set(
      key: string,
      value: unknown,
      options: {
        readonly expiresAt: number;
        readonly now: number;
        readonly tags: readonly string[];
      }
    ) {
      MutableHashMap.set(entries, key, {
        expiresAt: options.expiresAt,
        tags: options.tags,
        value,
      });
    },
  };
}

/** The store of the test file, emptied by `resetTestRuntimeCache`. */
let store = makeTestStore();

/** Every call of the store, recorded for the test to read. */
export const testRuntimeCache = {
  expireTag: vi.fn((tag: string) => store.expireTag(tag)),
  get: vi.fn((key: string, now: number) => store.get(key, now)),
  set: vi.fn(
    (key: string, value: unknown, options: Parameters<typeof store.set>[2]) =>
      store.set(key, value, options)
  ),
};

/** What the content store hands the store as a key: a SHA-256 digest in hex. */
export const STORE_KEY_PATTERN = /^[a-f\d]{64}$/u;

/** The module that a test hands to `vi.mock` in place of the store's memory module. */
export const testRuntimeCacheModule = {
  makeMemoryStore: () => testRuntimeCache,
};

/** Empties the shared store and forgets every recorded call. */
export function resetTestRuntimeCache() {
  store = makeTestStore();
  testRuntimeCache.expireTag.mockClear();
  testRuntimeCache.get.mockClear();
  testRuntimeCache.set.mockClear();
}
