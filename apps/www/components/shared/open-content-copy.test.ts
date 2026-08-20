import { Cause, Effect, Exit, Option } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  copyOpenContent,
  OpenContentCopyError,
} from "@/components/shared/open-content-copy";

const SOURCE_URL =
  "https://raw.githubusercontent.com/nakafaai/aksara/revision/source.mdx";
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe("copyOpenContent", () => {
  it("copies inline preview source without a network request", async () => {
    const fetchMock = vi.fn();
    const writeClipboard = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    await Effect.runPromise(
      copyOpenContent({ content: "## Preview", writeClipboard })
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(writeClipboard).toHaveBeenCalledWith("## Preview");
  });
  it("fetches one immutable published source only when copying", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response("## Published", { status: 200 }))
    );
    const writeClipboard = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    await Effect.runPromise(
      copyOpenContent({ copySourceUrl: SOURCE_URL, writeClipboard })
    );
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(SOURCE_URL, {
      signal: expect.any(AbortSignal),
    });
    expect(writeClipboard).toHaveBeenCalledWith("## Published");
  });
  it("fails when no reviewed source exists", async () => {
    await expectCopyFailure(
      copyOpenContent({ writeClipboard: vi.fn() }),
      "OPEN_CONTENT_SOURCE_MISSING"
    );
  });
  it("models network failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("offline")))
    );
    await expectCopyFailure(
      copyOpenContent({ copySourceUrl: SOURCE_URL, writeClipboard: vi.fn() }),
      "OPEN_CONTENT_SOURCE_FETCH_FAILED"
    );
  });
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
  it("rejects unsuccessful source responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(null, { status: 404 })))
    );
    await expectCopyFailure(
      copyOpenContent({ copySourceUrl: SOURCE_URL, writeClipboard: vi.fn() }),
      "OPEN_CONTENT_SOURCE_REJECTED"
    );
  });
  it("models source body read failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          text: () => Promise.reject(new Error("unreadable")),
        })
      )
    );
    await expectCopyFailure(
      copyOpenContent({ copySourceUrl: SOURCE_URL, writeClipboard: vi.fn() }),
      "OPEN_CONTENT_SOURCE_READ_FAILED"
    );
  });
  it("rejects empty published source", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("  \n", { status: 200 })))
    );
    await expectCopyFailure(
      copyOpenContent({ copySourceUrl: SOURCE_URL, writeClipboard: vi.fn() }),
      "OPEN_CONTENT_SOURCE_EMPTY"
    );
  });
  it("waits for and models clipboard rejection", async () => {
    const writeClipboard = vi.fn(() =>
      Promise.reject(new Error("clipboard denied"))
    );
    await expectCopyFailure(
      copyOpenContent({ content: "## Source", writeClipboard }),
      "OPEN_CONTENT_CLIPBOARD_FAILED"
    );
  });
});
async function expectCopyFailure(
  program: ReturnType<typeof copyOpenContent>,
  code: OpenContentCopyError["code"]
) {
  const exit = await Effect.runPromiseExit(program);
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
}
