import {
  CodeClipboardUnavailableError,
  CodeClipboardWriteError,
  writeCodeToClipboard,
} from "@repo/design-system/lib/code-block/clipboard";
import { Effect, Fiber } from "effect";
import { describe, expect, it, vi } from "vitest";

describe("code clipboard", () => {
  it("reports when the browser does not expose the Clipboard API", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const error = yield* writeCodeToClipboard(
          undefined,
          "const answer = 42;"
        ).pipe(Effect.flip);

        expect(error).toBeInstanceOf(CodeClipboardUnavailableError);
        expect(error).toMatchObject({
          _tag: "CodeClipboardUnavailableError",
          message: "Clipboard API is not available in this browser.",
        });
      })
    ));

  it("writes the exact code through the injected clipboard", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    return Effect.runPromise(
      Effect.gen(function* () {
        yield* writeCodeToClipboard({ writeText }, "const answer = 42;");

        expect(writeText).toHaveBeenCalledExactlyOnceWith("const answer = 42;");
      })
    );
  });

  it("maps clipboard failures into the typed error channel", () => {
    const cause = new Error("Clipboard permission denied.");
    const writeText = vi.fn().mockRejectedValue(cause);

    return Effect.runPromise(
      Effect.gen(function* () {
        const error = yield* writeCodeToClipboard(
          { writeText },
          "const answer = 42;"
        ).pipe(Effect.flip);

        expect(error).toBeInstanceOf(CodeClipboardWriteError);
        expect(error).toMatchObject({
          _tag: "CodeClipboardWriteError",
          cause,
          message: "Failed to copy the code block to the clipboard.",
        });
      })
    );
  });

  it("finishes an interrupted write before starting the next write", async () => {
    let finishFirstWrite: (() => void) | undefined;
    const writeText = vi.fn((code: string) => {
      if (code === "first") {
        return new Promise<void>((resolve) => {
          finishFirstWrite = resolve;
        });
      }
      return Promise.resolve();
    });
    const first = Effect.runFork(writeCodeToClipboard({ writeText }, "first"));
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith("first"));

    const interrupt = Effect.runFork(Fiber.interrupt(first));
    const second = Effect.runFork(
      writeCodeToClipboard({ writeText }, "second")
    );
    expect(writeText).not.toHaveBeenCalledWith("second");

    finishFirstWrite?.();
    await Effect.runPromise(Fiber.join(interrupt));
    await Effect.runPromise(Fiber.join(second));

    expect(writeText.mock.calls).toEqual([["first"], ["second"]]);
  });
});
