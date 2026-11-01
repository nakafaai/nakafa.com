import {
  Array as Arr,
  Effect,
  Option,
  Record as Rec,
  Schema,
  Tuple,
} from "effect";
import { KeyValueStore } from "effect/persistence";

/** Every name a try-out action can carry, which share its one cell. */
export const TryoutActionNameSchema = Schema.Literals([
  "start-cta",
  "continue-cta",
  "restart-cta",
]);

export type TryoutActionNameKey = typeof TryoutActionNameSchema.Type;

/** The browser storage key of the names a learner's set pages last read, by address. */
const KEPT_NAMES_KEY = "nakafa-tryout-names";

/** The attribute the page's script sets on the name's cell, which the styles read. */
export const KEPT_NAME_ATTRIBUTE = "data-kept-name";

/** How many pages the browser remembers. The page read longest ago leaves first. */
const KEPT_PAGES = 40;

const KeptNamesJson = Schema.fromJsonString(
  Schema.Record(Schema.String, TryoutActionNameSchema)
);

const decodeKeptNames = Schema.decodeOption(KeptNamesJson);

/**
 * The name of a set's action for its attempt: continue a running one, restart a finished one, and
 * start one otherwise.
 */
export function tryoutActionNameOf(
  attempt: { readonly status: string } | null | undefined
): TryoutActionNameKey {
  if (attempt?.status === "in-progress") {
    return "continue-cta";
  }
  return attempt ? "restart-cta" : "start-cta";
}

/** Reads the kept names. Storage that no longer decodes reads as nothing kept, and the next write replaces it. */
const readKeptNames = Effect.fn("tryout.kept.names")(function* () {
  const store = yield* KeyValueStore.KeyValueStore;
  const stored = yield* store.get(KEPT_NAMES_KEY);
  return Option.getOrElse(
    Option.flatMap(Option.fromNullishOr(stored), decodeKeptNames),
    () => Rec.empty<string, TryoutActionNameKey>()
  );
});

/** The name this browser last read for a page. */
export const readKeptName = Effect.fn("tryout.kept.read")(function* (
  address: string
) {
  return Rec.get(yield* readKeptNames(), address);
});

/** Keeps the name a page's read answered with, as the newest of the pages the browser remembers. */
export const keepName = Effect.fn("tryout.kept.keep")(function* (
  address: string,
  name: TryoutActionNameKey
) {
  const names = yield* readKeptNames();
  const store = yield* KeyValueStore.KeyValueStore;
  const newest = Arr.takeRight(
    Arr.append(
      Rec.toEntries(Rec.remove(names, address)),
      Tuple.make(address, name)
    ),
    KEPT_PAGES
  );
  const text = yield* Schema.encodeEffect(KeptNamesJson)(
    Rec.fromEntries(newest)
  ).pipe(Effect.orDie);
  yield* store.set(KEPT_NAMES_KEY, text);
});

/**
 * The inline script, the first child of the name's cell, that names the cell before the first paint.
 * No first paint knows a learner's attempt, but this browser may have read it before, so a set whose
 * attempt runs says Continue from its first frame. The read still decides. Storage the page cannot
 * read leaves the cell without a name, as a first visit is.
 */
export const KEPT_NAME_SCRIPT = Arr.join(
  [
    "(function () {",
    "  try {",
    `    var names = JSON.parse(localStorage.getItem('${KEPT_NAMES_KEY}') || 'null');`,
    "    var name = names && names[location.pathname];",
    `    if (typeof name === 'string') document.currentScript.parentElement.setAttribute('${KEPT_NAME_ATTRIBUTE}', name);`,
    "  } catch (error) {}",
    "})();",
  ],
  "\n"
);
