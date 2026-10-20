import { afterEach, describe, expect, it } from "@effect/vitest";
import {
  CodeHighlightError,
  highlightCode,
  UnsupportedCodeLanguageError,
  UnsupportedCodeThemeError,
} from "@repo/design-system/lib/code-block/highlight";
import { Effect } from "effect";

const shikiFailure = vi.hoisted(() => {
  let stage: string | undefined;
  return {
    current: () => stage,
    fail: (next: "html" | "theme" | undefined) => {
      stage = next;
    },
  };
});

vi.mock("@shikijs/core", async (importOriginal) => {
  const core = await importOriginal<typeof import("@shikijs/core")>();
  return {
    ...core,
    createHighlighterCore: async (
      options: Parameters<typeof core.createHighlighterCore>[0]
    ) => {
      const highlighter = await core.createHighlighterCore(options);
      return {
        ...highlighter,
        codeToHtml: (
          code: string,
          codeOptions: Parameters<typeof highlighter.codeToHtml>[1]
        ) => {
          if (shikiFailure.current() === "html") {
            throw new Error("Shiki failed to tokenize the code.");
          }
          return highlighter.codeToHtml(code, codeOptions);
        },
        loadTheme: (theme: Parameters<typeof highlighter.loadTheme>[0]) => {
          if (shikiFailure.current() === "theme") {
            return Promise.reject(new Error("Shiki failed to load the theme."));
          }
          return highlighter.loadTheme(theme);
        },
      };
    },
  };
});

afterEach(() => {
  shikiFailure.fail(undefined);
});

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

  it.effect("loads a theme registration that the caller provides", () =>
    Effect.gen(function* () {
      const html = yield* highlightCode({
        code: "const answer = 42;",
        language: "typescript",
        themes: {
          dark: "github-dark-default",
          light: {
            name: "plain-light",
            type: "light",
            colors: {},
            tokenColors: [],
          },
        },
      });

      expect(html).toContain("shiki-themes plain-light github-dark-default");
    })
  );

  it.effect("refuses a theme name that Shiki does not bundle", () =>
    Effect.gen(function* () {
      const error = yield* highlightCode({
        code: "const answer = 42;",
        language: "typescript",
        themes: {
          dark: "github-dark-default",
          light: "not-a-bundled-theme",
        },
      }).pipe(Effect.flip);

      expect(error).toBeInstanceOf(UnsupportedCodeThemeError);
      expect(error).toMatchObject({
        _tag: "UnsupportedCodeThemeError",
        message:
          'Code theme "not-a-bundled-theme" is not included in Shiki\'s bundle.',
        theme: "not-a-bundled-theme",
      });
    })
  );

  it.effect("maps a failure to load a theme into the typed error channel", () =>
    Effect.gen(function* () {
      shikiFailure.fail("theme");
      const error = yield* highlightCode({
        code: "const answer = 42;",
        language: "typescript",
      }).pipe(Effect.flip);

      expect(error).toBeInstanceOf(CodeHighlightError);
      expect(error).toMatchObject({
        _tag: "CodeHighlightError",
        language: "typescript",
        message: 'Failed to highlight code as "typescript".',
      });
    })
  );

  it.effect(
    "maps a failure to tokenize the code into the typed error channel",
    () =>
      Effect.gen(function* () {
        shikiFailure.fail("html");
        const error = yield* highlightCode({
          code: "const answer = 42;",
          language: "typescript",
        }).pipe(Effect.flip);

        expect(error).toBeInstanceOf(CodeHighlightError);
        expect(error).toMatchObject({
          _tag: "CodeHighlightError",
          language: "typescript",
        });
      })
  );
});
