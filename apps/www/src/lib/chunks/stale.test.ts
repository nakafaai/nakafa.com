import { afterEach, describe, expect, it } from "@effect/vitest";
import { GOING_ATTRIBUTE } from "@repo/design-system/lib/lazy";
import { Cause, Deferred, Effect, Exit, Fiber, Option } from "effect";
import { TestClock } from "effect/testing";
import {
  isStaleChunkError,
  readTab,
  recoverStaleFunction,
  reloadForStaleChunk,
  STALE_FUNCTION_MESSAGE,
} from "@/lib/chunks/stale";
import { tabStorage } from "@/lib/chunks/test.tab";

const CHROMIUM = new TypeError(
  "Failed to fetch dynamically imported module: https://nakafa.com/assets/schools-DhyL3sKZ.js"
);

/** A moment of a real tab, in milliseconds since 1970: 15 January 2027. */
const NOW = 1_800_000_000_000;

/** A tab's storage, and a reload that counts itself. */
function tab() {
  return { reload: vi.fn(), storage: tabStorage() };
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
    expect(
      isStaleChunkError(
        new TypeError(
          "Failed to load module script: Expected a JavaScript module script"
        )
      )
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
