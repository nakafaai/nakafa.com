import { preserveShikiLineBreaks } from "@repo/design-system/lib/code/lines";
import { DEFAULT_CODE_THEMES } from "@repo/design-system/lib/code/theme";
import {
  type CodeOptionsMultipleThemes,
  createHighlighterCore,
  type HighlighterCore,
  type LanguageInput,
  type ThemeInput,
} from "@shikijs/core";
import {
  transformerNotationDiff,
  transformerNotationErrorLevel,
  transformerNotationFocus,
  transformerNotationHighlight,
  transformerNotationWordHighlight,
} from "@shikijs/transformers";
import {
  Array as Arr,
  Effect,
  Option,
  Predicate,
  Record,
  Schema,
} from "effect";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

/** One theme of a code block: a bundled name, or a registration that Shiki loads as given. */
type CodeTheme = NonNullable<
  NonNullable<CodeOptionsMultipleThemes["themes"]>[string]
>;

/** Grammars by language name, each read on its first use. */
type CodeLanguages = Record.ReadonlyRecord<string, LanguageInput>;
/** Themes by name, each read on its first use. */
type CodeThemes = Record.ReadonlyRecord<string, ThemeInput>;

const PRE_BACKGROUND_STYLE_PATTERN =
  /(?<open><pre[^>]*?)\s+style="[^"]*background[^"]*"(?<rest>[^>]*>)/gu;

const CodeHighlightInputSchema = Schema.Struct({
  code: Schema.String,
  language: Schema.optional(Schema.String),
  transparentBackground: Schema.optionalKey(Schema.Boolean),
});

/** Input contract for one Shiki code-highlighting operation. */
export type CodeHighlightOptions = typeof CodeHighlightInputSchema.Type &
  Partial<Pick<CodeOptionsMultipleThemes, "themes">>;

/** Expected failure when a code block names a language its highlighter has no grammar for. */
export class UnsupportedCodeLanguageError extends Schema.TaggedError<
  UnsupportedCodeLanguageError,
  { readonly brand: unique symbol }
>()("UnsupportedCodeLanguageError", {
  language: Schema.String,
  message: Schema.String,
}) {}

/** Expected failure when a code block names a theme its highlighter does not register. */
export class UnsupportedCodeThemeError extends Schema.TaggedError<
  UnsupportedCodeThemeError,
  { readonly brand: unique symbol }
>()("UnsupportedCodeThemeError", {
  message: Schema.String,
  theme: Schema.String,
}) {}

/** Expected Shiki failure while rendering one supported code language. */
export class CodeHighlightError extends Schema.TaggedError<
  CodeHighlightError,
  { readonly brand: unique symbol }
>()("CodeHighlightError", {
  cause: Schema.Unknown,
  language: Schema.String,
  message: Schema.String,
}) {}

/**
 * Drops Shiki's inline background from the `<pre>` on request, so the code takes its surface's. The
 * `<pre>` keeps Shiki's own classes, which the dark theme's colours select (`codeBodyVariants`).
 */
function formatHighlightedHtml(html: string, transparentBackground: boolean) {
  if (!transparentBackground) {
    return html;
  }

  return html.replace(PRE_BACKGROUND_STYLE_PATTERN, "$1$2");
}

/** Maps any Shiki failure of one language's highlight to the one typed error of a code block. */
const toHighlightError = (language: string) => (cause: unknown) =>
  new CodeHighlightError({
    cause,
    language,
    message: `Failed to highlight code as "${language}".`,
  });

/** Loads one theme: a registered name by its name, and a registration as it is given. */
const loadTheme = Effect.fn("designSystem.codeBlock.loadTheme")(function* (
  shiki: HighlighterCore,
  registered: CodeThemes,
  theme: CodeTheme,
  language: string
) {
  if (typeof theme !== "string") {
    return yield* Effect.tryPromise({
      try: () => shiki.loadTheme(theme),
      catch: toHighlightError(language),
    });
  }
  const loader = Record.get(registered, theme);
  if (Option.isNone(loader)) {
    return yield* new UnsupportedCodeThemeError({
      message: `Code theme "${theme}" is not registered here.`,
      theme,
    });
  }
  return yield* Effect.tryPromise({
    try: () => shiki.loadTheme(loader.value),
    catch: toHighlightError(language),
  });
});

/**
 * A highlighter over the grammars and themes it registers, with Nakafa's shared Shiki transformers and
 * theme defaults. Every registered grammar is a module of the bundle that carries it, so the browser's
 * highlighter registers every grammar Shiki bundles (`browser.ts`) and a server only the grammars its pages
 * hold (`lesson.ts`). Shiki's default entry loads a WebAssembly regular-expression engine, which a server
 * bundle cannot carry, so it uses the JavaScript engine. Its Shiki instance starts on the first highlight.
 */
export function makeCodeHighlighter(
  languages: CodeLanguages,
  themes: CodeThemes
) {
  let highlighter: Promise<HighlighterCore> | undefined;
  const getHighlighter = () => {
    highlighter ??= createHighlighterCore({
      engine: createJavaScriptRegexEngine(),
      langs: [],
      themes: [],
    });
    return highlighter;
  };

  const highlightCode = Effect.fn("designSystem.codeBlock.highlight")(
    function* ({
      code,
      language = "typescript",
      themes: chosen,
      transparentBackground = false,
    }: CodeHighlightOptions) {
      const grammar = Record.get(languages, language);
      if (Option.isNone(grammar)) {
        return yield* new UnsupportedCodeLanguageError({
          language,
          message: `Code language "${language}" has no grammar here.`,
        });
      }

      const selectedThemes = chosen ?? DEFAULT_CODE_THEMES;
      const shiki = yield* Effect.tryPromise({
        try: getHighlighter,
        catch: toHighlightError(language),
      });
      for (const theme of Arr.filter(
        Record.values(selectedThemes),
        Predicate.isNotUndefined
      )) {
        yield* loadTheme(shiki, themes, theme, language);
      }

      const html = yield* Effect.tryPromise({
        try: async () => {
          await shiki.loadLanguage(grammar.value);
          return shiki.codeToHtml(code, {
            lang: language,
            themes: selectedThemes,
            transformers: [
              transformerNotationDiff({ matchAlgorithm: "v3" }),
              transformerNotationHighlight({ matchAlgorithm: "v3" }),
              transformerNotationWordHighlight({ matchAlgorithm: "v3" }),
              transformerNotationFocus({ matchAlgorithm: "v3" }),
              transformerNotationErrorLevel({ matchAlgorithm: "v3" }),
            ],
          });
        },
        catch: toHighlightError(language),
      });

      return preserveShikiLineBreaks(
        formatHighlightedHtml(html, transparentBackground)
      );
    }
  );

  return { highlightCode };
}
