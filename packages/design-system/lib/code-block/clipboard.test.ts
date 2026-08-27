import { describe, expect, it, vi } from "@effect/vitest";
import {
  CodeClipboardUnavailableError,
  CodeClipboardWriteError,
  writeCodeToClipboard,
} from "@repo/design-system/lib/code-block/clipboard";
import { Effect, Fiber } from "effect";

describe("code clipboard", () => {
  it.effect("reports when the browser does not expose the Clipboard API", () =>
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
  );

  it.effect("writes the exact code through the injected clipboard", () =>
    Effect.gen(function* () {
      const writeText = vi.fn().mockResolvedValue(undefined);

      yield* writeCodeToClipboard({ writeText }, "const answer = 42;");

      expect(writeText).toHaveBeenCalledExactlyOnceWith("const answer = 42;");
    })
  );

  it.effect("maps clipboard failures into the typed error channel", () =>
    Effect.gen(function* () {
      const cause = new Error("Clipboard permission denied.");
      const writeText = vi.fn().mockRejectedValue(cause);

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

  it.effect(
    "finishes an interrupted write before starting the next write",
    () =>
      Effect.gen(function* () {
        let finishFirstWrite: (() => void) | undefined;
        const writeText = vi.fn((code: string) => {
          if (code === "first") {
            return new Promise<void>((resolve) => {
              finishFirstWrite = resolve;
            });
          }
          return Promise.resolve();
        });
        const first = yield* Effect.forkChild(
          writeCodeToClipboard({ writeText }, "first")
        );
        yield* Effect.promise(() =>
          vi.waitFor(() => expect(writeText).toHaveBeenCalledWith("first"))
        );

        const interrupt = yield* Effect.forkChild(Fiber.interrupt(first));
        const second = yield* Effect.forkChild(
          writeCodeToClipboard({ writeText }, "second")
        );
        expect(writeText).not.toHaveBeenCalledWith("second");

        finishFirstWrite?.();
        yield* Fiber.join(interrupt);
        yield* Fiber.join(second);

        expect(writeText.mock.calls).toEqual([["first"], ["second"]]);
      })
  );
});
