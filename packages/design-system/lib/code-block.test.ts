import { Effect, Fiber } from "effect";
import type { CodeOptionsMultipleThemes } from "shiki";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CodeClipboardWriteError,
  CodeHighlightError,
  highlightCode,
  UnsupportedCodeLanguageError,
  writeCodeToClipboard,
} from "./code-block";

const { codeToHtmlMock } = vi.hoisted(() => ({
  codeToHtmlMock: vi.fn(),
}));

vi.mock("shiki", async (importOriginal) => {
  const shiki = await importOriginal<typeof import("shiki")>();

  return {
    ...shiki,
    codeToHtml: codeToHtmlMock,
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("code highlighting", () => {
  it("uses Nakafa's defaults and preserves Shiki line boundaries", () => {
    codeToHtmlMock.mockResolvedValue(
      '<span class="line">one</span><span class="line">two</span>'
    );

    return Effect.runPromise(
      Effect.gen(function* () {
        const html = yield* highlightCode({ code: "one\ntwo" });

        expect(html).toBe(
          '<span class="line">one</span>\n<span class="line">two</span>'
        );
        expect(codeToHtmlMock).toHaveBeenCalledWith(
          "one\ntwo",
          expect.objectContaining({
            lang: "typescript",
            themes: {
              dark: "github-dark-default",
              light: "github-light",
            },
          })
        );
      })
    );
  });

  it("forwards an explicit supported language and theme pair", () => {
    codeToHtmlMock.mockResolvedValue("<pre>const answer = 42;</pre>");
    const themes = {
      dark: "github-dark",
      light: "github-light-high-contrast",
    } satisfies CodeOptionsMultipleThemes["themes"];

    return Effect.runPromise(
      Effect.gen(function* () {
        yield* highlightCode({
          code: "const answer = 42;",
          language: "javascript",
          themes,
        });

        expect(codeToHtmlMock).toHaveBeenCalledWith(
          "const answer = 42;",
          expect.objectContaining({ lang: "javascript", themes })
        );
      })
    );
  });

  it("rejects unsupported languages before invoking Shiki", () => {
    const error = Effect.runSync(
      highlightCode({ code: "example", language: "not-a-language" }).pipe(
        Effect.flip
      )
    );

    expect(error).toBeInstanceOf(UnsupportedCodeLanguageError);
    expect(error).toMatchObject({
      _tag: "UnsupportedCodeLanguageError",
      language: "not-a-language",
      message:
        'Code language "not-a-language" is not included in Shiki\'s bundle.',
    });
    expect(codeToHtmlMock).not.toHaveBeenCalled();
  });

  it("maps Shiki rendering failures into the typed error channel", () => {
    const cause = new Error("Shiki failed to load its grammar.");
    codeToHtmlMock.mockRejectedValue(cause);

    return Effect.runPromise(
      Effect.gen(function* () {
        const error = yield* highlightCode({
          code: "const answer = 42;",
          language: "typescript",
        }).pipe(Effect.flip);

        expect(error).toBeInstanceOf(CodeHighlightError);
        expect(error).toMatchObject({
          _tag: "CodeHighlightError",
          cause,
          language: "typescript",
          message: 'Failed to highlight code as "typescript".',
        });
      })
    );
  });
});

describe("code clipboard", () => {
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
