import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { keyOf } from "@repo/backend/confect/island/award";
import { Array as Arr, Effect, Option, String as Str } from "effect";

/** More sections than any set holds, so one read takes every grant of a set. */
const SET_SECTIONS = 64;

/**
 * What a learner already holds of one try-out set's Stars (ADR 0042, D8): whether the set's own grant
 * is held, the keys of the sections whose grant is, and the Stars those grants gave, which the day's
 * limit may have cut. One point read and one range read of the
 * ledger, since every section key of the set shares the set's prefix.
 */
export const claimsOf = Effect.fn("island.claimsOf")(function* (
  userId: Docs["users"]["_id"],
  set: string
) {
  const database = yield* DatabaseReader;
  const prefix = keyOf({ _tag: "section", section: "", set });
  // The first key after every key of the prefix: its last character, the separator, raised by one.
  const after = `${Str.slice(0, -1)(prefix)};`;
  const held = yield* database
    .table("islandAwards")
    .index("by_userId_and_key", (query) =>
      query.eq("userId", userId).eq("key", keyOf({ _tag: "set", set }))
    )
    .first()
    .pipe(Effect.orDie);
  const sections = yield* database
    .table("islandAwards")
    .index("by_userId_and_key", (query) =>
      query.eq("userId", userId).gte("key", prefix).lt("key", after)
    )
    .take(SET_SECTIONS)
    .pipe(Effect.orDie);
  return {
    sections: Arr.map(sections, (row) => Str.slice(prefix.length)(row.key)),
    set: Option.isSome(held),
    stars: Arr.reduce(
      [...sections, ...Option.toArray(held)],
      0,
      (total, row) => total + row.stars
    ),
  };
});
