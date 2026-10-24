import "@tanstack/react-start/server-only";

import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, MutableHashMap, Option, Schema } from "effect";

/**
 * The most JSON bytes one isolate keeps. A Worker isolate has 128 MB and renders
 * every request in it, so the store stays far below that and evicts the rest.
 */
const MAX_STORE_BYTES = 16 * 1024 * 1024;

/** One stored value, its tags, its size, and the instant it stops being fresh. */
const MemoryEntrySchema = Schema.Struct({
  bytes: Schema.Finite,
  expiresAt: Schema.Finite,
  tags: Schema.Array(Schema.String),
  value: Schema.Unknown,
});
type MemoryEntry = typeof MemoryEntrySchema.Type;

/** The byte size of one value as JSON, which is what the store budgets. */
function sizeOf(value: unknown) {
  return new TextEncoder().encode(encodeJsonText(value)).byteLength;
}

/**
 * Keeps resolved values in one isolate for the content store. Workers has no
 * shared Runtime Cache, so each isolate holds its own entries. An entry is a
 * value that a request already resolved, never a promise, a stream or a
 * connection, so no request can wait on another request's I/O. An entry expires
 * by its lifetime everywhere, and by its tag only in the isolate that expires it;
 * the active release pointer carries the shortest lifetime for that reason.
 *
 * The clock is passed in by the caller, so the store reads no ambient time.
 */
export function makeMemoryStore() {
  const entries = MutableHashMap.empty<string, MemoryEntry>();

  /** Drops every entry whose lifetime has ended, then the oldest surplus until the budget holds. */
  function trim(now: number) {
    for (const [key, entry] of Arr.fromIterable(entries)) {
      if (entry.expiresAt <= now) {
        MutableHashMap.remove(entries, key);
      }
    }
    let total = 0;
    for (const [, entry] of Arr.fromIterable(entries)) {
      total += entry.bytes;
    }
    for (const [key, entry] of Arr.fromIterable(entries)) {
      if (total <= MAX_STORE_BYTES) {
        return;
      }
      MutableHashMap.remove(entries, key);
      total -= entry.bytes;
    }
  }

  return {
    /** The value under one key while its lifetime lasts, otherwise nothing. */
    get(key: string, now: number): Option.Option<unknown> {
      const found = MutableHashMap.get(entries, key);
      if (Option.isNone(found)) {
        return Option.none();
      }
      if (found.value.expiresAt <= now) {
        MutableHashMap.remove(entries, key);
        return Option.none();
      }
      return Option.some(found.value.value);
    },
    /** Stores one value under its key for `expiresAt`, replacing any earlier value. */
    set(
      key: string,
      value: unknown,
      input: {
        readonly expiresAt: number;
        readonly now: number;
        readonly tags: readonly string[];
      }
    ) {
      MutableHashMap.set(entries, key, {
        bytes: sizeOf(value),
        expiresAt: input.expiresAt,
        tags: [...input.tags],
        value,
      });
      trim(input.now);
    },
    /** Drops every entry of this isolate that carries one tag. */
    expireTag(tag: string) {
      for (const [key, entry] of Arr.fromIterable(entries)) {
        if (Arr.contains(entry.tags, tag)) {
          MutableHashMap.remove(entries, key);
        }
      }
    },
  };
}
