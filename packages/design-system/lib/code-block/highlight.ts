import { preserveShikiLineBreaks } from "@repo/design-system/lib/code-block/lines";
import {
  transformerNotationDiff,
  transformerNotationErrorLevel,
  transformerNotationFocus,
  transformerNotationHighlight,
  transformerNotationWordHighlight,
} from "@shikijs/transformers";
import { Effect, Schema } from "effect";
import {
  type BundledLanguage,
  bundledLanguages,
  type CodeOptionsMultipleThemes,
  codeToHtml,
} from "shiki";

const DEFAULT_CODE_THEMES = {
  light: "github-light",
  dark: "github-dark-default",
} satisfies CodeOptionsMultipleThemes["themes"];
const PRE_TAG_PATTERN = /<pre(\s|>)/;
const PRE_BACKGROUND_STYLE_PATTERN =
  /(<pre[^>]*?)\s+style="[^"]*background[^"]*"([^>]*>)/g;

/** Input contract for one Shiki code-highlighting operation. */
export interface CodeHighlightOptions {
  readonly code: string;
  readonly language?: string;
  readonly preClassName?: string;
  readonly themes?: CodeOptionsMultipleThemes["themes"];
  readonly transparentBackground?: boolean;
}

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

function isBundledLanguage(language: string): language is BundledLanguage {
  return Object.hasOwn(bundledLanguages, language);
}

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
      try: () =>
        codeToHtml(code, {
          lang: language,
          themes: themes ?? DEFAULT_CODE_THEMES,
          transformers: [
            transformerNotationDiff({ matchAlgorithm: "v3" }),
            transformerNotationHighlight({ matchAlgorithm: "v3" }),
            transformerNotationWordHighlight({ matchAlgorithm: "v3" }),
            transformerNotationFocus({ matchAlgorithm: "v3" }),
            transformerNotationErrorLevel({ matchAlgorithm: "v3" }),
          ],
        }),
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
