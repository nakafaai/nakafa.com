import {
  CodeHighlightError,
  highlightCode,
  UnsupportedCodeLanguageError,
} from "@repo/design-system/lib/code-block/highlight";
import { Effect } from "effect";
import type { CodeOptionsMultipleThemes } from "shiki";
import { afterEach, describe, expect, it, vi } from "vitest";

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

  it("applies a pre class and removes Shiki's inline background on request", () => {
    codeToHtmlMock.mockResolvedValue(
      '<pre style="background:#fff;color:#111"><code>example</code></pre>'
    );

    return Effect.runPromise(
      Effect.gen(function* () {
        const html = yield* highlightCode({
          code: "example",
          preClassName: "overflow-x-auto",
          transparentBackground: true,
        });

        expect(html).toBe(
          '<pre class="overflow-x-auto"><code>example</code></pre>'
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
