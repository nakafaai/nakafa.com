import { afterEach, describe, expect, it } from "@repo/testing/effect";
import { Cause, Effect, Exit, Option } from "effect";
import { vi } from "vitest";
import {
  copyOpenContent,
  OpenContentCopyError,
} from "@/components/shared/open-content/copy";

const SOURCE_URL =
  "https://raw.githubusercontent.com/nakafaai/aksara/revision/source.mdx";
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe("copyOpenContent", () => {
  it.live("copies inline preview source without a network request", () =>
    Effect.gen(function* () {
      const fetchMock = vi.fn();
      const writeClipboard = vi.fn(() => Promise.resolve());
      vi.stubGlobal("fetch", fetchMock);
      yield* copyOpenContent({ content: "## Preview", writeClipboard });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(writeClipboard).toHaveBeenCalledWith("## Preview");
    })
  );
  it.live("fetches one immutable published source only when copying", () =>
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
  it.live("fails when no reviewed source exists", () =>
    expectCopyFailure(
      copyOpenContent({ writeClipboard: vi.fn() }),
      "OPEN_CONTENT_SOURCE_MISSING"
    )
  );
  it.live("models network failures", () =>
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
  it("times out a source request that never settles", async () => {
    vi.useFakeTimers();
    let fetchSignal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_input, init) => {
        fetchSignal = init?.signal ?? undefined;
        return new Promise<Response>(() => undefined);
      })
    );
    // Vitest owns this Promise boundary so its fake clock can advance the live timeout.
    const exitPromise = Effect.runPromiseExit(
      copyOpenContent({ copySourceUrl: SOURCE_URL, writeClipboard: vi.fn() })
    );
    await vi.advanceTimersByTimeAsync(10_001);
    const exit = await exitPromise;
    const failure = Exit.isFailure(exit)
      ? Cause.findErrorOption(exit.cause)
      : Option.none();
    expect(Option.isSome(failure)).toBe(true);
    if (Option.isSome(failure)) {
      expect(failure.value).toMatchObject({
        code: "OPEN_CONTENT_SOURCE_FETCH_FAILED",
      });
    }
    expect(fetchSignal?.aborted).toBe(true);
  });
  it.live("rejects unsuccessful source responses", () =>
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
  it.live("models source body read failures", () =>
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
  it.live("rejects empty published source", () =>
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
  it.live("waits for and models clipboard rejection", () =>
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
    const exit = yield* Effect.exit(program);
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      return;
    }
    const failure = Cause.findErrorOption(exit.cause);
    expect(Option.isSome(failure)).toBe(true);
    if (Option.isSome(failure)) {
      expect(failure.value).toBeInstanceOf(OpenContentCopyError);
      expect(failure.value).toEqual(expect.objectContaining({ code }));
    }
  });
}
