import { Array as Arr, Effect, Option, Schema } from "effect";
import { KeyValueStore } from "effect/persistence";

/** Marks the inline script that carries the shell's lock into a page's first frame. */
export const PREPAINT_LOCK_ATTRIBUTE = "data-prepaint-lock";

/** The marker the shell's lock styles read before hydration, which the script sets on itself. */
const SHELL_LOCK_ATTRIBUTE = "data-shell-lock";

/** The browser storage key of the locked page the shell remembers. */
const PREPAINT_LOCK_KEY = "nakafa-shell-lock";

/**
 * One locked page the shell remembers: the query pair that names the page, as `?attemptId=` names a
 * running attempt's pages, and the moment the lock ends at the latest.
 */
export const PrepaintLock = Schema.Struct({
  name: Schema.String,
  until: Schema.Finite,
  value: Schema.String,
});

const PrepaintLockJson = Schema.fromJsonString(PrepaintLock);

/** Remembers that the pages whose address carries the lock's query pair hold the shell locked until it ends. */
export const rememberPrepaintLock = Effect.fn("shell.prepaint.remember")(
  function* (lock: typeof PrepaintLock.Type) {
    const store = yield* KeyValueStore.KeyValueStore;
    const text = yield* Schema.encodeEffect(PrepaintLockJson)(lock);
    yield* store.set(PREPAINT_LOCK_KEY, text);
  }
);

/**
 * Forgets the remembered lock whose query pair carries `value`, as its page lets the shell go. A lock
 * another page remembered since stays, and so does storage that holds no lock this module can read.
 */
export const forgetPrepaintLock = Effect.fn("shell.prepaint.forget")(function* (
  value: string
) {
  const store = yield* KeyValueStore.KeyValueStore;
  const kept = Option.fromNullishOr(yield* store.get(PREPAINT_LOCK_KEY)).pipe(
    Option.flatMap(Schema.decodeUnknownOption(PrepaintLockJson))
  );
  if (Option.exists(kept, (lock) => lock.value === value)) {
    yield* store.remove(PREPAINT_LOCK_KEY);
  }
});

/**
 * The inline script, the shell wrapper's first child, that locks a page's first frame. A prerendered
 * page cannot know that the attempt its address names runs, so a reload would paint the open shell and
 * lock it only once the learner's attempt arrives. When the address carries the query pair of the lock
 * the browser remembers, and the lock has not ended, the script marks itself as the server marks a
 * locked page, before the browser paints. A lock it cannot read, and storage the page cannot read, leave
 * the page open, as a page with no lock is.
 */
export const PREPAINT_LOCK_SCRIPT = Arr.join(
  [
    "(function () {",
    "  try {",
    `    var lock = JSON.parse(localStorage.getItem('${PREPAINT_LOCK_KEY}') || 'null');`,
    "    if (!lock || typeof lock.name !== 'string' || typeof lock.value !== 'string' || typeof lock.until !== 'number') return;",
    "    if (new URLSearchParams(location.search).get(lock.name) !== lock.value || Date.now() >= lock.until) return;",
    `    document.currentScript.setAttribute('${SHELL_LOCK_ATTRIBUTE}', '');`,
    "  } catch (error) {}",
    "})();",
  ],
  "\n"
);

/**
 * Lets go of the lock the script carried into the first frame, once the page decides for itself: its own
 * lock holds the shell, or its read found nothing that locks it.
 */
export function releasePrepaintLock(root: Pick<ParentNode, "querySelector">) {
  root
    .querySelector(`script[${PREPAINT_LOCK_ATTRIBUTE}]`)
    ?.removeAttribute(SHELL_LOCK_ATTRIBUTE);
}
