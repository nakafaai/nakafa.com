import { afterEach, describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { KeyValueStore } from "effect/persistence";
import {
  forgetPrepaintLock,
  PREPAINT_LOCK_ATTRIBUTE,
  PREPAINT_LOCK_SCRIPT,
  PrepaintLock,
  releasePrepaintLock,
  rememberPrepaintLock,
} from "@/components/sidebar/prepaint";

/** A lock that has not ended, and its stored text. */
const LOCK = { name: "attemptId", until: Number.MAX_SAFE_INTEGER, value: "a1" };

/** Writes any value as JSON text, as storage holds it. */
const jsonText = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));

/** Writes one lock as the store keeps it. */
const lockText = Schema.encodeSync(Schema.fromJsonString(PrepaintLock));

/** Runs the script as the page does, from a script element in the body, at `search`. */
function runScript(search: string) {
  window.history.replaceState(null, "", `/en/try-out/set${search}`);
  const script = document.createElement("script");
  script.setAttribute(PREPAINT_LOCK_ATTRIBUTE, "");
  document.body.append(script);
  Object.defineProperty(document, "currentScript", {
    configurable: true,
    value: script,
  });
  new Function(PREPAINT_LOCK_SCRIPT)();
  return script;
}

/** Keeps a lock in local storage, as the store writes it. */
function rememberInBrowser(lock: typeof LOCK) {
  localStorage.setItem("nakafa-shell-lock", lockText(lock));
}

describe("PREPAINT_LOCK_SCRIPT", () => {
  afterEach(() => {
    document.body.replaceChildren();
    localStorage.clear();
  });

  it("marks the first frame locked when the address names the remembered lock before it ends", () => {
    rememberInBrowser(LOCK);
    expect(
      runScript("?attemptId=a1&view=single").hasAttribute("data-shell-lock")
    ).toBe(true);
  });

  it("leaves the page open for another attempt, an ended lock, no lock, and a lock it cannot read", () => {
    rememberInBrowser(LOCK);
    expect(runScript("?attemptId=b2").hasAttribute("data-shell-lock")).toBe(
      false
    );
    rememberInBrowser({ ...LOCK, until: 0 });
    expect(runScript("?attemptId=a1").hasAttribute("data-shell-lock")).toBe(
      false
    );
    localStorage.clear();
    expect(runScript("?attemptId=a1").hasAttribute("data-shell-lock")).toBe(
      false
    );
    localStorage.setItem("nakafa-shell-lock", "{");
    expect(runScript("?attemptId=a1").hasAttribute("data-shell-lock")).toBe(
      false
    );
    localStorage.setItem("nakafa-shell-lock", jsonText({ name: "attemptId" }));
    expect(runScript("?attemptId=a1").hasAttribute("data-shell-lock")).toBe(
      false
    );
  });

  it("lets go of the mark once the page decides, and finds nothing to release on a page without it", () => {
    rememberInBrowser(LOCK);
    const script = runScript("?attemptId=a1");
    releasePrepaintLock(document);
    expect(script.hasAttribute("data-shell-lock")).toBe(false);
    document.body.replaceChildren();
    expect(() => releasePrepaintLock(document)).not.toThrow();
  });
});

describe("the remembered lock", () => {
  it.effect("remembers a lock and forgets it only for its own attempt", () =>
    Effect.gen(function* () {
      const store = yield* KeyValueStore.KeyValueStore;
      yield* rememberPrepaintLock(LOCK);
      yield* forgetPrepaintLock("b2");
      expect(yield* store.get("nakafa-shell-lock")).toBe(lockText(LOCK));
      yield* forgetPrepaintLock("a1");
      expect(yield* store.get("nakafa-shell-lock")).toBeUndefined();
    }).pipe(Effect.provide(KeyValueStore.layerMemory))
  );

  it.effect("leaves storage it cannot read as a lock alone", () =>
    Effect.gen(function* () {
      const store = yield* KeyValueStore.KeyValueStore;
      yield* store.set("nakafa-shell-lock", "{");
      yield* forgetPrepaintLock("a1");
      expect(yield* store.get("nakafa-shell-lock")).toBe("{");
    }).pipe(Effect.provide(KeyValueStore.layerMemory))
  );
});
