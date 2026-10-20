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
import { Array as Arr, Effect, Predicate, Schema } from "effect";
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

/** Loads the themes of one highlight, and refuses a theme name that Shiki does not bundle. */
async function loadThemes(
  shiki: HighlighterCore,
  themes: CodeOptionsMultipleThemes["themes"] = DEFAULT_CODE_THEMES
) {
  for (const theme of Arr.filter(
    Object.values(themes),
    Predicate.isNotUndefined
  )) {
    if (typeof theme !== "string") {
      await shiki.loadTheme(theme);
      continue;
    }
    if (!isBundledTheme(theme)) {
      throw new Error(`Theme "${theme}" is not included in Shiki's bundle.`);
    }
    await shiki.loadTheme(bundledThemes[theme]);
  }
}

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

    const html = yield* Effect.tryPromise({
      try: async () => {
        const shiki = await getHighlighter();
        const selectedThemes = themes ?? DEFAULT_CODE_THEMES;
        await shiki.loadLanguage(bundledLanguages[language]);
        await loadThemes(shiki, selectedThemes);
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
      catch: (cause) =>
        new CodeHighlightError({
          cause,
          language,
          message: `Failed to highlight code as "${language}".`,
        }),
    });

    return preserveShikiLineBreaks(
      formatHighlightedHtml(html, preClassName, transparentBackground)
    );
  }
);
