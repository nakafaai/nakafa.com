import { afterEach, describe, expect, it } from "@effect/vitest";
import { Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";
import {
  copyOpenContent,
  OpenContentCopyError,
} from "@/components/shared/open-content/copy";

const SOURCE_URL =
  "https://raw.githubusercontent.com/nakafaai/aksara/revision/source.mdx";
afterEach(() => {
  vi.unstubAllGlobals();
});
describe("copyOpenContent", () => {
  it.effect("copies inline preview source without a network request", () =>
    Effect.gen(function* () {
      const fetchMock = vi.fn();
      const writeClipboard = vi.fn(() => Promise.resolve());
      vi.stubGlobal("fetch", fetchMock);
      yield* copyOpenContent({ content: "## Preview", writeClipboard });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(writeClipboard).toHaveBeenCalledWith("## Preview");
    })
  );
  it.effect("fetches one immutable published source only when copying", () =>
    Effect.gen(function* () {
      const fetchMock = vi.fn(() =>
        Promise.resolve(new Response("## Published", { status: 200 }))
      );
      const writeClipboard = vi.fn(() => Promise.resolve());
      vi.stubGlobal("fetch", fetchMock);
      yield* copyOpenContent({ copySourceUrl: SOURCE_URL, writeClipboard });
      expect(fetchMock).toHaveBeenCalledOnce();
      expect(fetchMock).toHaveBeenCalledWith(SOURCE_URL, {
        signal: expect.any(AbortSignal),
      });
      expect(writeClipboard).toHaveBeenCalledWith("## Published");
    })
  );
  it.effect("fails when no reviewed source exists", () =>
    expectCopyFailure(
      copyOpenContent({ writeClipboard: vi.fn() }),
      "OPEN_CONTENT_SOURCE_MISSING"
    )
  );
  it.effect("models network failures", () =>
    Effect.gen(function* () {
      vi.stubGlobal(
        "fetch",
        vi.fn(() => Promise.reject(new Error("offline")))
      );
      yield* expectCopyFailure(
        copyOpenContent({ copySourceUrl: SOURCE_URL, writeClipboard: vi.fn() }),
        "OPEN_CONTENT_SOURCE_FETCH_FAILED"
      );
    })
  );
  it.effect("times out a source request that never settles", () =>
    Effect.gen(function* () {
      let fetchSignal: AbortSignal | undefined;
      vi.stubGlobal(
        "fetch",
        vi.fn((_input, init) => {
          fetchSignal = init?.signal ?? undefined;
          return new Promise<Response>(() => undefined);
        })
      );
      const fiber = yield* expectCopyFailure(
        copyOpenContent({ copySourceUrl: SOURCE_URL, writeClipboard: vi.fn() }),
        "OPEN_CONTENT_SOURCE_FETCH_FAILED"
      ).pipe(Effect.forkChild);

      yield* Effect.yieldNow;
      expect(fetchSignal).toBeDefined();
      yield* TestClock.adjust("10 seconds");
      yield* Fiber.join(fiber);

      expect(fetchSignal?.aborted).toBe(true);
    })
  );
  it.effect("rejects unsuccessful source responses", () =>
    Effect.gen(function* () {
      vi.stubGlobal(
        "fetch",
        vi.fn(() => Promise.resolve(new Response(null, { status: 404 })))
      );
      yield* expectCopyFailure(
        copyOpenContent({ copySourceUrl: SOURCE_URL, writeClipboard: vi.fn() }),
        "OPEN_CONTENT_SOURCE_REJECTED"
      );
    })
  );
  it.effect("models source body read failures", () =>
    Effect.gen(function* () {
      vi.stubGlobal(
        "fetch",
        vi.fn(() =>
          Promise.resolve({
            ok: true,
            text: () => Promise.reject(new Error("unreadable")),
          })
        )
      );
      yield* expectCopyFailure(
        copyOpenContent({ copySourceUrl: SOURCE_URL, writeClipboard: vi.fn() }),
        "OPEN_CONTENT_SOURCE_READ_FAILED"
      );
    })
  );
  it.effect("rejects empty published source", () =>
    Effect.gen(function* () {
      vi.stubGlobal(
        "fetch",
        vi.fn(() => Promise.resolve(new Response("  \n", { status: 200 })))
      );
      yield* expectCopyFailure(
        copyOpenContent({ copySourceUrl: SOURCE_URL, writeClipboard: vi.fn() }),
        "OPEN_CONTENT_SOURCE_EMPTY"
      );
    })
  );
  it.effect("waits for and models clipboard rejection", () =>
    Effect.gen(function* () {
      const writeClipboard = vi.fn(() =>
        Promise.reject(new Error("clipboard denied"))
      );
      yield* expectCopyFailure(
        copyOpenContent({ content: "## Source", writeClipboard }),
        "OPEN_CONTENT_CLIPBOARD_FAILED"
      );
    })
  );
});
function expectCopyFailure(
  program: ReturnType<typeof copyOpenContent>,
  code: OpenContentCopyError["code"]
) {
  return Effect.gen(function* () {
    const failure = yield* Effect.flip(program);
    expect(failure).toBeInstanceOf(OpenContentCopyError);
    expect(failure).toEqual(expect.objectContaining({ code }));
  });
}
