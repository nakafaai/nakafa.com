import { isBundledLanguage } from "@repo/design-system/lib/code-block/language";
import { preserveShikiLineBreaks } from "@repo/design-system/lib/code-block/lines";
import {
  type CodeOptionsMultipleThemes,
  createHighlighterCore,
  type HighlighterCore,
} from "@shikijs/core";
import {
  transformerNotationDiff,
  transformerNotationErrorLevel,
  transformerNotationFocus,
  transformerNotationHighlight,
  transformerNotationWordHighlight,
} from "@shikijs/transformers";
import { Array as Arr, Effect, Predicate, Record, Schema } from "effect";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import { bundledLanguages } from "shiki/langs";
import { type BundledTheme, bundledThemes } from "shiki/themes";

/**
 * The only default theme pair. The light theme is the high-contrast variant: every
 * token colour that paints text on its white background meets WCAG 2.2 AA (4.5:1),
 * where github-light does not. A code surface that the page tints can lower that
 * contrast, and this pair does not guarantee it. The carriage-return, markup.deleted,
 * markup.inserted, markup.changed, markup.ignored, and markup.untracked scopes paint
 * their own background, with their diff header and punctuation scopes, so their text
 * is judged on that background instead.
 */
/** One theme of a code block: a bundled name, or a registration that Shiki loads as given. */
type CodeTheme = NonNullable<CodeOptionsMultipleThemes["themes"]>[string];

export const DEFAULT_CODE_THEMES = {
  light: "github-light-high-contrast",
  dark: "github-dark-default",
} satisfies CodeOptionsMultipleThemes["themes"];
/**
 * One highlighter for the process. Shiki's default entry loads a WebAssembly
 * regular-expression engine, which the server bundle cannot carry, so this entry
 * uses the JavaScript engine and loads each grammar and theme on first use.
 */
let highlighter: Promise<HighlighterCore> | undefined;

function isBundledTheme(theme: string): theme is BundledTheme {
  return Object.hasOwn(bundledThemes, theme);
}

function getHighlighter() {
  highlighter ??= createHighlighterCore({
    engine: createJavaScriptRegexEngine(),
    langs: [],
    themes: [],
  });
  return highlighter;
}

const PRE_TAG_PATTERN = /<pre(\s|>)/;
const PRE_BACKGROUND_STYLE_PATTERN =
  /(<pre[^>]*?)\s+style="[^"]*background[^"]*"([^>]*>)/g;

const CodeHighlightInputSchema = Schema.Struct({
  code: Schema.String,
  language: Schema.optional(Schema.String),
  preClassName: Schema.optional(Schema.String),
  transparentBackground: Schema.optionalKey(Schema.Boolean),
});

/** Input contract for one Shiki code-highlighting operation. */
export type CodeHighlightOptions = typeof CodeHighlightInputSchema.Type &
  Partial<Pick<CodeOptionsMultipleThemes, "themes">>;

/** Expected failure when a code block names a language outside Shiki's bundle. */
export class UnsupportedCodeLanguageError extends Schema.TaggedError<UnsupportedCodeLanguageError>()(
  "UnsupportedCodeLanguageError",
  {
    language: Schema.String,
    message: Schema.String,
  }
) {}

/** Expected failure when a code block names a theme outside Shiki's bundle. */
export class UnsupportedCodeThemeError extends Schema.TaggedError<UnsupportedCodeThemeError>()(
  "UnsupportedCodeThemeError",
  {
    message: Schema.String,
    theme: Schema.String,
  }
) {}

/** Expected Shiki failure while rendering one supported code language. */
export class CodeHighlightError extends Schema.TaggedError<CodeHighlightError>()(
  "CodeHighlightError",
  {
    cause: Schema.Unknown,
    language: Schema.String,
    message: Schema.String,
  }
) {}

function formatHighlightedHtml(
  html: string,
  preClassName: string | undefined,
  transparentBackground: boolean
) {
  const withPreClass = preClassName
    ? html.replace(PRE_TAG_PATTERN, `<pre class="${preClassName}"$1`)
    : html;

  if (!transparentBackground) {
    return withPreClass;
  }

  return withPreClass.replace(PRE_BACKGROUND_STYLE_PATTERN, "$1$2");
}

/** Maps any Shiki failure of one language's highlight to the one typed error of a code block. */
const toHighlightError = (language: string) => (cause: unknown) =>
  new CodeHighlightError({
    cause,
    language,
    message: `Failed to highlight code as "${language}".`,
  });

/** Loads one theme: a bundled name by its name, and a registration as it is given. */
const loadTheme = Effect.fn("designSystem.codeBlock.loadTheme")(function* (
  shiki: HighlighterCore,
  theme: CodeTheme,
  language: string
) {
  if (typeof theme !== "string") {
    return yield* Effect.tryPromise({
      try: () => shiki.loadTheme(theme),
      catch: toHighlightError(language),
    });
  }
  if (!isBundledTheme(theme)) {
    return yield* new UnsupportedCodeThemeError({
      message: `Code theme "${theme}" is not included in Shiki's bundle.`,
      theme,
    });
  }
  return yield* Effect.tryPromise({
    try: () => shiki.loadTheme(bundledThemes[theme]),
    catch: toHighlightError(language),
  });
});

/** Highlights code with Nakafa's shared Shiki transformers and theme defaults. */
export const highlightCode = Effect.fn("designSystem.codeBlock.highlight")(
  function* ({
    code,
    language = "typescript",
    preClassName,
    themes,
    transparentBackground = false,
  }: CodeHighlightOptions) {
    if (!isBundledLanguage(language)) {
      return yield* new UnsupportedCodeLanguageError({
        language,
        message: `Code language "${language}" is not included in Shiki's bundle.`,
      });
    }

    const selectedThemes = themes ?? DEFAULT_CODE_THEMES;
    const shiki = yield* Effect.tryPromise({
      try: getHighlighter,
      catch: toHighlightError(language),
    });
    for (const theme of Arr.filter(
      Record.values(selectedThemes),
      Predicate.isNotUndefined
    )) {
      yield* loadTheme(shiki, theme, language);
    }

    const html = yield* Effect.tryPromise({
      try: async () => {
        await shiki.loadLanguage(bundledLanguages[language]);
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
      formatHighlightedHtml(html, preClassName, transparentBackground)
    );
  }
);
