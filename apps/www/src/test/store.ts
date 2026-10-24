import { encodeJsonText, JsonTextSchema } from "@repo/utilities/json";
import { Array as Arr, MutableHashMap, Option, Schema } from "effect";

const decodeJsonText = Schema.decodeSync(JsonTextSchema);

const TestRuntimeOptionsSchema = Schema.Struct({
  name: Schema.String,
  tags: Schema.Array(Schema.String),
  ttl: Schema.Finite,
});
const TestRuntimeEntrySchema = Schema.Struct({
  ...TestRuntimeOptionsSchema.fields,
  text: Schema.String,
});
/** What the stand-in remembers about one stored entry. */
type TestRuntimeEntry = typeof TestRuntimeEntrySchema.Type;

/**
 * An in-memory stand-in for the Vercel Runtime Cache. Like the real client it
 * keeps each value as JSON text, answers a miss with `null`, and expires every
 * entry that carries a tag. Every call is recorded for the test to read. The
 * content store never deletes a key, so the stand-in has no delete.
 */
function makeTestRuntimeCache() {
  const entries = MutableHashMap.empty<string, TestRuntimeEntry>();
  return {
    entries,
    expireTag: vi.fn((tag: string) => {
      const expired = Arr.filter(Arr.fromIterable(entries), ([, entry]) =>
        Arr.contains(entry.tags, tag)
      );
      for (const [key] of expired) {
        MutableHashMap.remove(entries, key);
      }
      return Promise.resolve();
    }),
    get: vi.fn((key: string) =>
      Promise.resolve(
        Option.match(MutableHashMap.get(entries, key), {
          onNone: () => null,
          onSome: ({ text }) => decodeJsonText(text),
        })
      )
    ),
    set: vi.fn(
      (
        key: string,
        value: unknown,
        options: typeof TestRuntimeOptionsSchema.Type
      ) => {
        MutableHashMap.set(entries, key, {
          ...options,
          text: encodeJsonText(value),
        });
        return Promise.resolve();
      }
    ),
  };
}

/** What the content store hands the Runtime Cache as a key: a SHA-256 digest in hex. */
export const STORE_KEY_PATTERN = /^[a-f\d]{64}$/u;

/** The one Runtime Cache stand-in that a test file hands to `getCache`. */
export const testRuntimeCache = makeTestRuntimeCache();

/** The module that a test hands to `vi.mock` in place of `@vercel/functions`. */
export const testRuntimeCacheModule = {
  getCache: () => testRuntimeCache,
};

/** Empties the shared stand-in and forgets every recorded call. */
export function resetTestRuntimeCache() {
  MutableHashMap.clear(testRuntimeCache.entries);
  testRuntimeCache.expireTag.mockClear();
  testRuntimeCache.get.mockClear();
  testRuntimeCache.set.mockClear();
}
