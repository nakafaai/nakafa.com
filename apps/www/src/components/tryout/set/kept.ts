import {
  Array as Arr,
  Effect,
  Option,
  Record as Rec,
  Schema,
  Tuple,
} from "effect";
import { KeyValueStore } from "effect/persistence";
import { keptStorage } from "@/components/player/storage";
import { reportClientException } from "@/lib/analytics/client";
import { SIGNED_IN_ATTRIBUTE } from "@/lib/auth/hint";

/** Every name a try-out action can carry, which share its one cell. */
export const TryoutActionNameSchema = Schema.Literals([
  "start-cta",
  "continue-cta",
  "restart-cta",
]);

export type TryoutActionNameKey = typeof TryoutActionNameSchema.Type;

/** The browser storage key of the names a learner's set pages last read, by address. */
const KEPT_NAMES_KEY = "nakafa-tryout-names";

/** The browser storage key of the label each page's attempt picker last showed, by address and search. */
const KEPT_ATTEMPTS_KEY = "nakafa-tryout-attempts";

/** The attribute the page's script sets on the name's cell, which the styles read. */
const KEPT_NAME_ATTRIBUTE = "data-kept-name";

/** How many pages the browser remembers. The page read longest ago leaves first. */
const KEPT_PAGES = 40;

/** The part of an attempt that names a set's action. */
const AttemptStatus = Schema.Struct({ status: Schema.String });

const KeptPagesJson = Schema.fromJsonString(
  Schema.Record(Schema.String, Schema.String)
);

const decodeKeptPages = Schema.decodeOption(KeptPagesJson);

const decodeName = Schema.decodeUnknownOption(TryoutActionNameSchema);

/**
 * The name of a set's action for its attempt: continue a running one, restart a finished one, and
 * start one otherwise.
 */
export function tryoutActionNameOf(
  attempt: typeof AttemptStatus.Type | null | undefined
): TryoutActionNameKey {
  if (attempt?.status === "in-progress") {
    return "continue-cta";
  }
  return attempt ? "restart-cta" : "start-cta";
}

/** Reads a kept record. Storage that no longer decodes reads as nothing kept, and the next write replaces it. */
const readKeptPages = Effect.fn("tryout.kept.pages")(function* (key: string) {
  const store = yield* KeyValueStore.KeyValueStore;
  const stored = yield* store.get(key);
  return Option.getOrElse(
    Option.flatMap(Option.fromNullishOr(stored), decodeKeptPages),
    () => Rec.empty<string, string>()
  );
});

/** Keeps what a page's read answered with, as the newest of the pages the browser remembers. */
const keepPage = Effect.fn("tryout.kept.page")(function* (
  key: string,
  address: string,
  value: string
) {
  const pages = yield* readKeptPages(key);
  const store = yield* KeyValueStore.KeyValueStore;
  const newest = Arr.takeRight(
    Arr.append(
      Rec.toEntries(Rec.remove(pages, address)),
      Tuple.make(address, value)
    ),
    KEPT_PAGES
  );
  const text = yield* Schema.encodeEffect(KeptPagesJson)(
    Rec.fromEntries(newest)
  ).pipe(Effect.orDie);
  yield* store.set(key, text);
});

/** The name this browser last read for a page. */
export const readKeptName = Effect.fn("tryout.kept.read")(function* (
  address: string
) {
  return Option.flatMap(
    Rec.get(yield* readKeptPages(KEPT_NAMES_KEY), address),
    decodeName
  );
});

/** Keeps the name a page's read answered with. */
export const keepName = Effect.fn("tryout.kept.keep")(function* (
  address: string,
  name: TryoutActionNameKey
) {
  yield* keepPage(KEPT_NAMES_KEY, address, name);
});

/**
 * The label this browser last showed on a page's attempt picker. Only a finished page has a picker, so
 * a page whose kept name is not Restart has none, whatever an older read kept.
 */
export const readKeptAttempt = Effect.fn("tryout.kept.attempt")(function* (
  pathname: string,
  search: string
) {
  const name = yield* readKeptName(pathname);
  if (Option.getOrUndefined(name) !== "restart-cta") {
    return Option.none<string>();
  }
  return Rec.get(
    yield* readKeptPages(KEPT_ATTEMPTS_KEY),
    `${pathname}${search}`
  );
});

/**
 * Keeps a set's name for this browser's next hard load. A browser that refuses its storage paints the
 * page as a first visit does.
 */
export const keepActionName = Effect.fn("tryout.kept.action")(
  function* (address: string, name: TryoutActionNameKey) {
    yield* keepName(address, name);
  },
  Effect.provide(keptStorage),
  Effect.catchTag("KeyValueStoreError", (error) =>
    reportClientException(error, { source: "components/tryout/set/kept" })
  )
);

/**
 * Keeps a page's picker label for this browser's next hard load. A browser that refuses its storage
 * paints the page as a first visit does.
 */
export const keepAttemptLabel = Effect.fn("tryout.kept.label")(
  function* (address: string, label: string) {
    yield* keepPage(KEPT_ATTEMPTS_KEY, address, label);
  },
  Effect.provide(keptStorage),
  Effect.catchTag("KeyValueStoreError", (error) =>
    reportClientException(error, { source: "components/tryout/set/kept" })
  )
);

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

/**
 * The inline script, the last child of the picker's place, that shows the place before the first paint.
 * A set this browser saw tried more than once keeps its picker from the first frame, under the label
 * it last showed. The read still decides. Storage the page cannot read leaves the place empty.
 */
export const KEPT_ATTEMPT_SCRIPT = Arr.join(
  [
    "(function () {",
    "  try {",
    `    if (document.documentElement.getAttribute('${SIGNED_IN_ATTRIBUTE}') !== 'yes') return;`,
    `    var names = JSON.parse(localStorage.getItem('${KEPT_NAMES_KEY}') || 'null');`,
    `    var labels = JSON.parse(localStorage.getItem('${KEPT_ATTEMPTS_KEY}') || 'null');`,
    "    var label = labels && labels[location.pathname + location.search];",
    "    if (typeof label !== 'string' || !names || names[location.pathname] !== 'restart-cta') return;",
    "    var place = document.currentScript.parentElement;",
    "    place.querySelector('[data-label]').setAttribute('data-label', label);",
    "    place.removeAttribute('data-empty');",
    "  } catch (error) {}",
    "})();",
  ],
  "\n"
);

/**
 * The inline script, the last child of a finished page's pane place, that stands the place at the screen's
 * right before the first paint. A page this browser last read as finished will hold its result pane once its
 * read answers, and the page narrows beside a pane, so the place narrows it from the first frame and nothing
 * moves when the pane arrives. The read still decides.
 */
export const KEPT_PANE_SCRIPT = Arr.join(
  [
    "(function () {",
    "  try {",
    `    if (document.documentElement.getAttribute('${SIGNED_IN_ATTRIBUTE}') !== 'yes') return;`,
    `    var names = JSON.parse(localStorage.getItem('${KEPT_NAMES_KEY}') || 'null');`,
    "    if (!names || names[location.pathname] !== 'restart-cta') return;",
    "    var place = document.currentScript.parentElement;",
    "    place.setAttribute('data-pane-side', 'lg');",
    "    place.removeAttribute('data-empty');",
    "  } catch (error) {}",
    "})();",
  ],
  "\n"
);
