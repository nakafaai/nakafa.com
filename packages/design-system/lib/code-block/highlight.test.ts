import { describe, expect, it } from "@effect/vitest";
import {
  CodeHighlightError,
  highlightCode,
  UnsupportedCodeLanguageError,
} from "@repo/design-system/lib/code-block/highlight";
import { Effect } from "effect";

describe("code highlighting", () => {
  it.effect("uses Nakafa's default theme pair and keeps line boundaries", () =>
    Effect.gen(function* () {
      const html = yield* highlightCode({ code: "one\ntwo" });

      expect(html).toContain(
        "shiki-themes github-light-high-contrast github-dark-default"
      );
      expect(html).toContain('</span>\n<span class="line');
    })
  );

  it.effect("forwards an explicit supported language and theme pair", () =>
    Effect.gen(function* () {
      const html = yield* highlightCode({
        code: "const answer = 42;",
        language: "javascript",
        themes: {
          dark: "github-dark",
          light: "github-light-high-contrast",
        },
      });

      expect(html).toContain(
        "shiki-themes github-light-high-contrast github-dark"
      );
      expect(html).toContain("answer");
    })
  );

  it.effect(
    "applies a pre class and removes Shiki's inline background on request",
    () =>
      Effect.gen(function* () {
        const html = yield* highlightCode({
          code: "example",
          preClassName: "overflow-x-auto",
          transparentBackground: true,
        });

        expect(html.startsWith('<pre class="overflow-x-auto"')).toBe(true);
        expect(html).not.toContain("background-color");
      })
  );

  it.effect("rejects unsupported languages before Shiki loads anything", () =>
    Effect.gen(function* () {
      const error = yield* highlightCode({
        code: "example",
        language: "not-a-language",
      }).pipe(Effect.flip);

      expect(error).toBeInstanceOf(UnsupportedCodeLanguageError);
      expect(error).toMatchObject({
        _tag: "UnsupportedCodeLanguageError",
        language: "not-a-language",
        message:
          'Code language "not-a-language" is not included in Shiki\'s bundle.',
      });
    })
  );

  it.effect("maps Shiki rendering failures into the typed error channel", () =>
    Effect.gen(function* () {
      const error = yield* highlightCode({
        code: "const answer = 42;",
        language: "typescript",
        themes: {
          dark: "github-dark-default",
          light: "not-a-bundled-theme",
        },
      }).pipe(Effect.flip);

      expect(error).toBeInstanceOf(CodeHighlightError);
      expect(error).toMatchObject({
        _tag: "CodeHighlightError",
        language: "typescript",
        message: 'Failed to highlight code as "typescript".',
      });
    })
  );
});
