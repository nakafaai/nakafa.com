import { afterEach, describe, expect, it } from "@effect/vitest";
import { Effect, Fiber } from "effect";
import { FetchHttpClient } from "effect/http";
import { TestClock } from "effect/testing";
import {
  OpenContentCopyError,
  readOpenContentCopySource,
  writeOpenContentCopy,
} from "@/components/shared/content/copy";

const SOURCE_PATH = "/en/subjects/mathematics/analytic-geometry/hyperbola.md";
type CopySource = Parameters<typeof readOpenContentCopySource>[0];

/** Records what a clipboard item was built from, as the browser would hold it. */
class ClipboardItemDouble {
  readonly items: Record<string, Promise<Blob>>;

  constructor(items: Record<string, Promise<Blob>>) {
    this.items = items;
  }
}

/** Reads one source through the request module's own client with a controlled fetch. */
function read(
  input: CopySource,
  fetcher: typeof fetch = vi.fn<typeof fetch>()
) {
  return readOpenContentCopySource(input).pipe(
    Effect.provideService(FetchHttpClient.Fetch, fetcher)
  );
}

/** Builds a source that loads only when the test completes it. */
function pendingSource() {
  let load: (text: string) => void = () => undefined;
  const promise = new Promise<string>((resolve) => {
    load = resolve;
  });
  return { load, promise };
}

/** Installs a clipboard and reports which of its two writes a copy used. */
function stubClipboard(options: { readonly items: boolean }) {
  const write =
    vi.fn<(items: readonly ClipboardItemDouble[]) => Promise<void>>();
  const writeText = vi.fn<(text: string) => Promise<void>>();
  vi.stubGlobal("navigator", { clipboard: { write, writeText } });
  vi.stubGlobal(
    "ClipboardItem",
    options.items ? ClipboardItemDouble : undefined
  );
  return { write, writeText };
}

describe("readOpenContentCopySource", () => {
  it.effect("returns inline preview source without a network request", () =>
    Effect.gen(function* () {
      const fetchMock = vi.fn<typeof fetch>();
      expect(yield* read({ content: "## Preview" }, fetchMock)).toBe(
        "## Preview"
      );
      expect(fetchMock).not.toHaveBeenCalled();
    })
  );
  it.effect("fetches the first-party markdown source only when copying", () =>
    Effect.gen(function* () {
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response("## Published", { status: 200 }));
      expect(yield* read({ copySourceUrl: SOURCE_PATH }, fetchMock)).toBe(
        "## Published"
      );
      expect(fetchMock).toHaveBeenCalledOnce();
      expect(fetchMock).toHaveBeenCalledWith(
        new URL(SOURCE_PATH, window.location.href),
        expect.objectContaining({
          method: "GET",
          signal: expect.any(AbortSignal),
        })
      );
    })
  );
  it.effect("fails when no reviewed source exists", () =>
    expectCopyFailure(read({}), "OPEN_CONTENT_SOURCE_MISSING")
  );
  it.effect("models network failures", () =>
    expectCopyFailure(
      read(
        { copySourceUrl: SOURCE_PATH },
        vi.fn<typeof fetch>().mockRejectedValue(new Error("offline"))
      ),
      "OPEN_CONTENT_SOURCE_FETCH_FAILED"
    )
  );
  it.effect("times out a source request that never settles", () =>
    Effect.gen(function* () {
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockImplementation(() => new Promise<Response>(() => undefined));
      const fiber = yield* expectCopyFailure(
        read({ copySourceUrl: SOURCE_PATH }, fetchMock),
        "OPEN_CONTENT_SOURCE_FETCH_FAILED"
      ).pipe(Effect.forkChild);

      yield* Effect.promise(() =>
        vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
      );
      const fetchSignal = fetchMock.mock.calls[0]?.[1]?.signal;
      expect(fetchSignal).toBeDefined();
      yield* TestClock.adjust("10 seconds");
      yield* Fiber.join(fiber);

      expect(fetchSignal?.aborted).toBe(true);
    })
  );
  it.effect("rejects unsuccessful source responses", () =>
    expectCopyFailure(
      read(
        { copySourceUrl: SOURCE_PATH },
        vi
          .fn<typeof fetch>()
          .mockResolvedValue(new Response(null, { status: 404 }))
      ),
      "OPEN_CONTENT_SOURCE_REJECTED"
    )
  );
  it.effect("models source body read failures", () =>
    expectCopyFailure(
      read(
        { copySourceUrl: SOURCE_PATH },
        vi.fn<typeof fetch>().mockResolvedValue(
          new Response(
            new ReadableStream({
              /** Fails before the source body yields any bytes. */
              pull(controller) {
                controller.error(new Error("unreadable"));
              },
            }),
            { status: 200 }
          )
        )
      ),
      "OPEN_CONTENT_SOURCE_READ_FAILED"
    )
  );
  it.effect("fails when the request module cannot be loaded", () =>
    Effect.gen(function* () {
      vi.doMock("@/components/shared/content/source", () => {
        throw new Error("chunk load failed");
      });
      yield* expectCopyFailure(
        read({ copySourceUrl: SOURCE_PATH }),
        "OPEN_CONTENT_SOURCE_FETCH_FAILED"
      ).pipe(
        Effect.ensuring(
          Effect.sync(() => vi.doUnmock("@/components/shared/content/source"))
        )
      );
    })
  );
  it.effect("rejects empty published source", () =>
    expectCopyFailure(
      read(
        { copySourceUrl: SOURCE_PATH },
        vi
          .fn<typeof fetch>()
          .mockResolvedValue(new Response("  \n", { status: 200 }))
      ),
      "OPEN_CONTENT_SOURCE_EMPTY"
    )
  );
});

describe("writeOpenContentCopy", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.effect("starts the write before the source has loaded", () =>
    Effect.gen(function* () {
      const { write, writeText } = stubClipboard({ items: true });
      write.mockResolvedValue(undefined);
      const source = pendingSource();

      const copy = yield* writeOpenContentCopy(source.promise).pipe(
        Effect.forkChild
      );
      yield* Effect.yieldNow;
      expect(write).toHaveBeenCalledOnce();
      source.load("## Published");
      yield* Fiber.join(copy);

      const blob = yield* Effect.promise(
        async () => await write.mock.calls[0]?.[0][0]?.items["text/plain"]
      );
      expect(blob?.type).toBe("text/plain");
      expect(yield* Effect.promise(async () => await blob?.text())).toBe(
        "## Published"
      );
      expect(writeText).not.toHaveBeenCalled();
    })
  );
  it.effect("writes the loaded text where clipboard items are missing", () =>
    Effect.gen(function* () {
      const { write, writeText } = stubClipboard({ items: false });
      writeText.mockResolvedValue(undefined);

      yield* writeOpenContentCopy(Promise.resolve("## Published"));

      expect(writeText).toHaveBeenCalledWith("## Published");
      expect(write).not.toHaveBeenCalled();
    })
  );
  it.effect("models a clipboard that refuses the write", () =>
    Effect.gen(function* () {
      const { write } = stubClipboard({ items: true });
      write.mockRejectedValue(new Error("clipboard denied"));

      yield* expectCopyFailure(
        writeOpenContentCopy(Promise.resolve("## Source")),
        "OPEN_CONTENT_CLIPBOARD_FAILED"
      );
    })
  );
  it.effect("models a clipboard that throws instead of rejecting", () =>
    Effect.gen(function* () {
      const { write } = stubClipboard({ items: true });
      write.mockImplementation(() => {
        throw new TypeError("write is not supported");
      });

      yield* expectCopyFailure(
        writeOpenContentCopy(Promise.reject(new Error("source failed"))),
        "OPEN_CONTENT_CLIPBOARD_FAILED"
      );
    })
  );
  it.effect("models a source that never reaches the clipboard", () =>
    Effect.gen(function* () {
      const { writeText } = stubClipboard({ items: false });

      yield* expectCopyFailure(
        writeOpenContentCopy(Promise.reject(new Error("source failed"))),
        "OPEN_CONTENT_CLIPBOARD_FAILED"
      );
      expect(writeText).not.toHaveBeenCalled();
    })
  );
});
function expectCopyFailure(
  program: Effect.Effect<unknown, OpenContentCopyError>,
  code: OpenContentCopyError["code"]
) {
  return Effect.gen(function* () {
    const failure = yield* Effect.flip(program);
    expect(failure).toBeInstanceOf(OpenContentCopyError);
    expect(failure).toEqual(expect.objectContaining({ code }));
  });
}
