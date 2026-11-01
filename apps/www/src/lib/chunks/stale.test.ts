import { afterEach, describe, expect, it } from "@effect/vitest";
import { Deferred, Effect, Exit, Fiber, MutableHashMap, Option } from "effect";
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

/** A tab's storage that holds what the page wrote, and a reload that counts itself. */
function tab() {
  const values = MutableHashMap.empty<string, string>();
  const storage = {
    getItem: (key: string) => Option.getOrNull(MutableHashMap.get(values, key)),
    setItem: (key: string, value: string) => {
      MutableHashMap.set(values, key, value);
    },
  };
  const reload = vi.fn();
  return { reload, storage };
}

describe("stale chunks", () => {
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
      const { reload, storage } = tab();

      expect(yield* reloadForStaleChunk("/en", storage, reload)).toBe(true);
      expect(yield* reloadForStaleChunk("/en", storage, reload)).toBe(false);
      expect(reload).toHaveBeenCalledTimes(1);
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
function openDocument(storage: Pick<Storage, "getItem" | "setItem">) {
  const target = new EventTarget();
  const reload = vi.fn<() => void>();
  new Function("window", "sessionStorage", "location", STALE_CHUNK_SCRIPT)(
    target,
    storage,
    { pathname: "/en/quran", reload }
  );
  return { reload, target };
}

/** Reports a missing script and says whether the failure was taken over. */
function reportMissingScript(target: EventTarget) {
  const event = new Event("vite:preloadError", { cancelable: true });
  target.dispatchEvent(event);
  return event.defaultPrevented;
}

describe("STALE_CHUNK_SCRIPT", () => {
  it("reloads once and holds back every failure until the page goes", () => {
    const { reload, target } = openDocument(tab().storage);

    expect(reportMissingScript(target)).toBe(true);
    expect(reportMissingScript(target)).toBe(true);
    expect(reload).toHaveBeenCalledOnce();
  });

  it("lets the error boundary answer once the tab has reloaded, so it cannot loop", () => {
    const { storage } = tab();
    reportMissingScript(openDocument(storage).target);

    const { reload, target } = openDocument(storage);

    expect(reportMissingScript(target)).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it("shares its mark with the error boundary, so an address reloads once between them", async () => {
    const { reload, storage } = tab();
    reportMissingScript(openDocument(storage).target);

    await expect(
      Effect.runPromise(reloadForStaleChunk("/en/quran", storage, reload))
    ).resolves.toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it("never reloads without storage, which could not stop a loop", () => {
    const refused = () => {
      throw new Error("Storage is off.");
    };
    const { reload, target } = openDocument({
      getItem: refused,
      setItem: refused,
    });

    expect(reportMissingScript(target)).toBe(false);
    expect(reload).not.toHaveBeenCalled();
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
      const { reload, storage } = tab();
      yield* reloadForStaleChunk("/en", storage, reload);
      reload.mockClear();

      const cause = yield* recoverStaleFunction(failing(gone), () =>
        Option.some({ address: "/en", reload, storage })
      ).pipe(Effect.flip);

      expect(cause).toBe(gone);
      expect(reload).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "gives a loader's call on the server its failure, with no tab to reload",
    () =>
      Effect.gen(function* () {
        const cause = yield* recoverStaleFunction(
          failing(gone),
          Option.none
        ).pipe(Effect.flip);

        expect(cause).toBe(gone);
      })
  );

  it.effect("reads the tab only once a call has failed", () =>
    Effect.gen(function* () {
      const tab = vi.fn(Option.none);

      yield* recoverStaleFunction(() => Promise.resolve("read"), tab);

      expect(tab).not.toHaveBeenCalled();
    })
  );

  it.effect("leaves every other failure alone", () =>
    Effect.gen(function* () {
      const { reload, storage } = tab();
      const other = new Error("The read failed.");

      const cause = yield* recoverStaleFunction(failing(other), () =>
        Option.some({ address: "/en", reload, storage })
      ).pipe(Effect.flip);

      expect(cause).toBe(other);
      expect(reload).not.toHaveBeenCalled();
    })
  );
});
