import { afterEach, describe, expect, it } from "@effect/vitest";
import { GOING_ATTRIBUTE } from "@repo/design-system/lib/lazy";
import {
  Cause,
  Deferred,
  Effect,
  Exit,
  Fiber,
  MutableHashMap,
  Option,
} from "effect";
import { TestClock } from "effect/testing";
import {
  isStaleChunkError,
  readTab,
  recoverStaleFunction,
  reloadForStaleChunk,
  STALE_CHUNK_SCRIPT,
  STALE_FUNCTION_MESSAGE,
} from "@/lib/chunks/stale";

const CHROMIUM = new TypeError(
  "Failed to fetch dynamically imported module: https://nakafa.com/assets/schools-DhyL3sKZ.js"
);

/** A moment of a real tab, in milliseconds since 1970: 15 January 2027. */
const NOW = 1_800_000_000_000;

/** The storage key of the reload mark of `/en/quran`. */
const QURAN_MARK = "nakafa:stale-chunk:/en/quran";

/** A tab's storage that holds what the page wrote, and a reload that counts itself. */
function tab() {
  const values = MutableHashMap.empty<string, string>();
  const storage = {
    getItem: (key: string) => Option.getOrNull(MutableHashMap.get(values, key)),
    removeItem: (key: string) => {
      MutableHashMap.remove(values, key);
    },
    setItem: (key: string, value: string) => {
      MutableHashMap.set(values, key, value);
    },
  };
  const reload = vi.fn();
  return { reload, storage };
}

describe("stale chunks", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("recognizes the missing chunk of every browser and nothing else", () => {
    expect(isStaleChunkError(CHROMIUM)).toBe(true);
    expect(
      isStaleChunkError(
        new TypeError(
          "error loading dynamically imported module: https://nakafa.com/assets/a.js"
        )
      )
    ).toBe(true);
    expect(
      isStaleChunkError(new TypeError("Importing a module script failed."))
    ).toBe(true);
    expect(isStaleChunkError(new Error("Something else failed"))).toBe(false);
    expect(
      isStaleChunkError("Failed to fetch dynamically imported module")
    ).toBe(false);
  });

  it.effect("reloads once for a missing chunk, then lets its error show", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(NOW);
      const { reload, storage } = tab();

      expect(yield* reloadForStaleChunk("/en", storage, reload)).toBe(true);
      yield* TestClock.adjust("59 seconds");
      expect(yield* reloadForStaleChunk("/en", storage, reload)).toBe(false);
      expect(reload).toHaveBeenCalledTimes(1);
    })
  );

  it.effect(
    "reloads again for the next deploy once its hold has passed, whatever the old mark says",
    () =>
      Effect.gen(function* () {
        yield* TestClock.setTime(NOW);
        const { reload, storage } = tab();
        // The mark of an earlier release, which held no time.
        storage.setItem("nakafa:stale-chunk:/en", "1");

        expect(yield* reloadForStaleChunk("/en", storage, reload)).toBe(true);
        yield* TestClock.adjust("1 minute");
        expect(yield* reloadForStaleChunk("/en", storage, reload)).toBe(true);
        // A mark from a later moment, which a changed clock leaves behind.
        storage.setItem("nakafa:stale-chunk:/en", String(NOW * 2));
        expect(yield* reloadForStaleChunk("/en", storage, reload)).toBe(true);
        expect(reload).toHaveBeenCalledTimes(3);
      })
  );

  it.effect(
    "keeps the page without a network, and reloads once the network is back",
    () =>
      Effect.gen(function* () {
        const { reload, storage } = tab();
        const onLine = vi.spyOn(navigator, "onLine", "get");
        onLine.mockReturnValue(false);

        expect(yield* reloadForStaleChunk("/en", storage, reload)).toBe(false);
        expect(reload).not.toHaveBeenCalled();

        onLine.mockReturnValue(true);

        expect(yield* reloadForStaleChunk("/en", storage, reload)).toBe(true);
        expect(reload).toHaveBeenCalledOnce();
      })
  );

  it.effect("never reloads when the tab cannot keep the mark", () =>
    Effect.gen(function* () {
      const reload = vi.fn();
      const storage = {
        getItem: () => null,
        setItem: () => {
          throw new DOMException("full", "QuotaExceededError");
        },
      };

      expect(yield* reloadForStaleChunk("/en", storage, reload)).toBe(false);
      expect(reload).not.toHaveBeenCalled();
    })
  );

  it.effect("never reloads when the tab's storage refuses", () =>
    Effect.gen(function* () {
      const reload = vi.fn();
      const storage = {
        getItem: (): string | null => {
          throw new DOMException("denied", "SecurityError");
        },
        setItem: vi.fn(),
      };

      expect(yield* reloadForStaleChunk("/en", storage, reload)).toBe(false);
      expect(reload).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "reloads an address once, whichever of its chunks is missing next, and another address once too",
    () =>
      Effect.gen(function* () {
        yield* TestClock.setTime(NOW);
        const { reload, storage } = tab();

        expect(yield* reloadForStaleChunk("/en", storage, reload)).toBe(true);
        expect(yield* reloadForStaleChunk("/en", storage, reload)).toBe(false);
        expect(yield* reloadForStaleChunk("/en/auth", storage, reload)).toBe(
          true
        );
        expect(reload).toHaveBeenCalledTimes(2);
      })
  );
});

/** Runs the head script in a document of its own, over the tab's storage. */
function openDocument(
  storage: Pick<Storage, "getItem" | "removeItem" | "setItem">,
  onLine = true
) {
  const target = new EventTarget();
  const root = document.createElement("html");
  const reload = vi.fn<() => void>();
  new Function(
    "window",
    "sessionStorage",
    "location",
    "navigator",
    "document",
    STALE_CHUNK_SCRIPT
  )(
    target,
    storage,
    { pathname: "/en/quran", reload },
    { onLine },
    { documentElement: root }
  );
  return { reload, root, target };
}

/** Reports a missing script and says whether the failure was taken over. */
function reportMissingScript(target: EventTarget) {
  const event = new Event("vite:preloadError", { cancelable: true });
  target.dispatchEvent(event);
  return event.defaultPrevented;
}

describe("STALE_CHUNK_SCRIPT", () => {
  it("reloads once, says so on the root element, and hands each failure on to its import", () => {
    const { reload, root, target } = openDocument(tab().storage);

    expect(reportMissingScript(target)).toBe(false);
    expect(reportMissingScript(target)).toBe(false);
    expect(reload).toHaveBeenCalledOnce();
    expect(root.getAttribute(GOING_ATTRIBUTE)).toBe("reload");
  });

  it("lets the error boundary answer once the tab has reloaded, so it cannot loop", () => {
    const { storage } = tab();
    reportMissingScript(openDocument(storage).target);

    const { reload, root, target } = openDocument(storage);

    expect(reportMissingScript(target)).toBe(false);
    expect(reload).not.toHaveBeenCalled();
    expect(root.getAttribute(GOING_ATTRIBUTE)).toBeNull();
  });

  it("reloads a tab that reloaded for an earlier deploy again", () => {
    const { storage } = tab();
    // The mark of an earlier release, which held no time.
    storage.setItem(QURAN_MARK, "1");

    const { reload, target } = openDocument(storage);
    reportMissingScript(target);

    expect(reload).toHaveBeenCalledOnce();
  });

  it.live(
    "shares its mark with the error boundary, so an address reloads once between them",
    () =>
      Effect.gen(function* () {
        const { reload, storage } = tab();
        reportMissingScript(openDocument(storage).target);

        expect(yield* reloadForStaleChunk("/en/quran", storage, reload)).toBe(
          false
        );
        expect(reload).not.toHaveBeenCalled();
      })
  );

  it("keeps the page without a network, and reloads once the network is back", () => {
    const { storage } = tab();
    const offline = openDocument(storage, false);

    reportMissingScript(offline.target);
    expect(offline.reload).not.toHaveBeenCalled();
    expect(offline.root.getAttribute(GOING_ATTRIBUTE)).toBeNull();

    const online = openDocument(storage);

    reportMissingScript(online.target);
    expect(online.reload).toHaveBeenCalledOnce();
  });

  it("keeps a tab that is leaving from cancelling its navigation with a reload", () => {
    const { reload, root, target } = openDocument(tab().storage);

    target.dispatchEvent(new Event("beforeunload"));

    expect(root.getAttribute(GOING_ATTRIBUTE)).toBe("leave");
    expect(reportMissingScript(target)).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it("ends the leave at the next press, once a prompt kept the page", () => {
    const { reload, root, target } = openDocument(tab().storage);

    target.dispatchEvent(new Event("beforeunload"));
    target.dispatchEvent(new Event("pointerdown"));

    expect(root.getAttribute(GOING_ATTRIBUTE)).toBeNull();
    reportMissingScript(target);
    expect(reload).toHaveBeenCalledOnce();
  });

  it("gives back the mark of a reload that a prompt stopped, so the next failure reloads", () => {
    const { storage } = tab();
    const { reload, root, target } = openDocument(storage);

    reportMissingScript(target);
    // The reload's own beforeunload leaves its reason as it is.
    target.dispatchEvent(new Event("beforeunload"));
    expect(root.getAttribute(GOING_ATTRIBUTE)).toBe("reload");
    target.dispatchEvent(new Event("keydown"));

    expect(root.getAttribute(GOING_ATTRIBUTE)).toBeNull();
    expect(storage.getItem(QURAN_MARK)).toBeNull();
    reportMissingScript(target);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("keeps a press after a stopped reload from failing where storage refuses removal", () => {
    const { storage } = tab();
    const { reload, root, target } = openDocument({
      ...storage,
      removeItem: () => {
        throw new Error("Storage is off.");
      },
    });

    reportMissingScript(target);
    target.dispatchEvent(new Event("pointerdown"));

    expect(root.getAttribute(GOING_ATTRIBUTE)).toBeNull();
    expect(reload).toHaveBeenCalledOnce();
  });

  it("reloads again once the page comes back from the back-forward cache", () => {
    const { reload, target } = openDocument(tab().storage);

    target.dispatchEvent(new Event("pageshow"));
    target.dispatchEvent(new Event("beforeunload"));
    target.dispatchEvent(new Event("pageshow"));

    reportMissingScript(target);
    expect(reload).toHaveBeenCalledOnce();
  });

  it("never reloads without storage, which could not stop a loop", () => {
    const refused = () => {
      throw new Error("Storage is off.");
    };
    const { reload, root, target } = openDocument({
      getItem: refused,
      removeItem: refused,
      setItem: refused,
    });

    reportMissingScript(target);
    expect(reload).not.toHaveBeenCalled();
    expect(root.getAttribute(GOING_ATTRIBUTE)).toBeNull();
  });
});

describe("readTab", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("has no tab during server rendering", () => {
    vi.stubGlobal("window", undefined);

    expect(Option.isNone(readTab())).toBe(true);
  });

  it("reads the address in the browser, and storage only at its use", () => {
    const reload = vi.fn();
    const sessionStorage = { getItem: vi.fn(() => "1"), setItem: vi.fn() };
    vi.stubGlobal("window", {
      location: { pathname: "/en/quran", reload },
      sessionStorage,
    });

    const tab = Option.getOrThrow(readTab());
    tab.reload();
    tab.storage.setItem("mark", "2");

    expect(tab.address).toBe("/en/quran");
    expect(reload).toHaveBeenCalledOnce();
    expect(document.documentElement.getAttribute(GOING_ATTRIBUTE)).toBe(
      "reload"
    );
    document.documentElement.removeAttribute(GOING_ATTRIBUTE);
    expect(tab.storage.getItem("mark")).toBe("1");
    expect(sessionStorage.setItem).toHaveBeenCalledWith("mark", "2");
  });

  it.effect("keeps a browser that refuses storage from reloading", () =>
    Effect.gen(function* () {
      const reload = vi.fn();
      vi.stubGlobal("window", {
        location: { pathname: "/en" },
        get sessionStorage() {
          throw new Error("Storage is off.");
        },
      });
      const { storage } = Option.getOrThrow(readTab());

      expect(yield* reloadForStaleChunk("/en", storage, reload)).toBe(false);
      expect(reload).not.toHaveBeenCalled();
    })
  );
});

/** What a caller of the effect receives when it fails, as `Effect.runPromise` rejects with it. */
const thrownBy = <A>(call: Effect.Effect<A>) =>
  Effect.exit(call).pipe(
    Effect.map((exit) =>
      Exit.isFailure(exit) ? Cause.squash(exit.cause) : undefined
    )
  );

describe("recoverStaleFunction", () => {
  const gone = new Error(STALE_FUNCTION_MESSAGE);
  const failing = (cause: Error) => () => Promise.reject(cause);

  it.effect("answers what the call answers", () =>
    Effect.gen(function* () {
      expect(yield* recoverStaleFunction(() => Promise.resolve("read"))).toBe(
        "read"
      );
    })
  );

  it.effect(
    "reloads for a function that a deploy removed, and holds the call",
    () =>
      Effect.gen(function* () {
        const { storage } = tab();
        const reloaded = yield* Deferred.make<void>();
        const page = {
          address: "/en",
          reload: () => Deferred.doneUnsafe(reloaded, Exit.void),
          storage,
        };

        const held = yield* Effect.forkChild(
          recoverStaleFunction(failing(gone), () => Option.some(page))
        );
        yield* Deferred.await(reloaded);
        yield* Effect.yieldNow;

        expect(held.pollUnsafe()).toBeUndefined();
        yield* Fiber.interrupt(held);
      })
  );

  it.effect("gives the caller the failure once the address has reloaded", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(NOW);
      const { reload, storage } = tab();
      yield* reloadForStaleChunk("/en", storage, reload);
      reload.mockClear();

      const thrown = yield* thrownBy(
        recoverStaleFunction(failing(gone), () =>
          Option.some({ address: "/en", reload, storage })
        )
      );

      expect(thrown).toBe(gone);
      expect(reload).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "gives a loader's call on the server its failure, with no tab to reload",
    () =>
      Effect.gen(function* () {
        const thrown = yield* thrownBy(
          recoverStaleFunction(failing(gone), Option.none)
        );

        expect(thrown).toBe(gone);
      })
  );

  it.effect("reads the tab only once a call has failed", () =>
    Effect.gen(function* () {
      const read = vi.fn<typeof readTab>(Option.none);

      yield* recoverStaleFunction(() => Promise.resolve("read"), read);

      expect(read).not.toHaveBeenCalled();
    })
  );

  it.effect("hands the caller every other failure as the call threw it", () =>
    Effect.gen(function* () {
      const { reload, storage } = tab();
      const redirect = { to: "/en/auth" };

      const thrown = yield* thrownBy(
        recoverStaleFunction(
          () => Promise.reject(redirect),
          () => Option.some({ address: "/en", reload, storage })
        )
      );

      expect(thrown).toBe(redirect);
      expect(reload).not.toHaveBeenCalled();
    })
  );
});
