import { preserveShikiLineBreaks } from "@repo/design-system/lib/shiki";
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

const clipboardWriteSemaphore = Effect.unsafeMakeSemaphore(1);

const DEFAULT_CODE_THEMES = {
  light: "github-light",
  dark: "github-dark-default",
} satisfies CodeOptionsMultipleThemes["themes"];

/** Input contract for one Shiki code-highlighting operation. */
export interface CodeHighlightOptions {
  readonly code: string;
  readonly language?: string;
  readonly themes?: CodeOptionsMultipleThemes["themes"];
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

/** Expected browser failure while writing code to the clipboard. */
export class CodeClipboardWriteError extends Schema.TaggedError<CodeClipboardWriteError>()(
  "CodeClipboardWriteError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

function isBundledLanguage(language: string): language is BundledLanguage {
  return Object.hasOwn(bundledLanguages, language);
}

/** Highlights code with Nakafa's shared Shiki transformers and theme defaults. */
export const highlightCode = Effect.fn("designSystem.codeBlock.highlight")(
  function* ({ code, language = "typescript", themes }: CodeHighlightOptions) {
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

    return preserveShikiLineBreaks(html);
  }
);

/** Writes one code sample through an injected browser clipboard boundary. */
export const writeCodeToClipboard = Effect.fn(
  "designSystem.codeBlock.writeClipboard"
)((clipboard: Pick<Clipboard, "writeText">, code: string) =>
  clipboardWriteSemaphore.withPermits(1)(
    Effect.uninterruptible(
      Effect.tryPromise({
        try: () => clipboard.writeText(code),
        catch: (cause) =>
          new CodeClipboardWriteError({
            cause,
            message: "Failed to copy the code block to the clipboard.",
          }),
      })
    )
  )
);
