import { captureException } from "@repo/analytics/posthog/capture";
import { CodeBlockText } from "@repo/design-system/components/code-block/text";
import type { CodeHighlightOptions } from "@repo/design-system/lib/code-block/highlight";
import type { CodeOptionsMultipleThemes } from "@shikijs/core";
import { Effect, Fiber, Schema } from "effect";
import type { HTMLAttributes } from "react";
import { useEffect, useMemo, useState } from "react";

/** Highlighting options plus the exact source used by the text fallback. */
type CodeBlockContentProps = HTMLAttributes<HTMLDivElement> & {
  children: string;
  language?: string;
  /** The highlighted HTML that a server drew, which needs no highlighter here. */
  serverHtml?: string;
  syntaxHighlighting?: boolean;
  themes?: CodeOptionsMultipleThemes["themes"];
  transparentBackground?: boolean;
};

const CodeHighlightRequestSchema = Schema.Struct({
  children: Schema.String,
  language: Schema.UndefinedOr(Schema.String),
  syntaxHighlighting: Schema.Boolean,
  transparentBackground: Schema.Boolean,
});
type CodeHighlightRequest = typeof CodeHighlightRequestSchema.Type &
  Pick<CodeHighlightOptions, "themes">;

/** The highlighter's code could not load, so the block stays plain text. */
class CodeHighlighterLoadError extends Schema.TaggedError<CodeHighlighterLoadError>()(
  "CodeHighlighterLoadError",
  { cause: Schema.Unknown }
) {}

/** The highlighter, which only code that a server did not draw loads. */
const loadHighlighter = Effect.tryPromise({
  try: () => import("@repo/design-system/lib/code-block/highlight"),
  catch: (cause) => new CodeHighlighterLoadError({ cause }),
});

/** Highlights client-rendered code while retaining a safe text fallback. */
export function CodeBlockContent({
  children,
  themes,
  language,
  serverHtml,
  syntaxHighlighting = true,
  transparentBackground = false,
  ...props
}: CodeBlockContentProps) {
  const request = useMemo<CodeHighlightRequest>(
    () => ({
      children,
      language,
      syntaxHighlighting,
      ...(themes === undefined ? {} : { themes }),
      transparentBackground,
    }),
    [children, language, syntaxHighlighting, themes, transparentBackground]
  );
  const [highlightedCode, setHighlightedCode] = useState<{
    html: string;
    request: CodeHighlightRequest | null;
  }>({
    html: "",
    request: null,
  });

  useEffect(() => {
    if (!request.syntaxHighlighting || serverHtml !== undefined) {
      return;
    }

    const fiber = Effect.runFork(
      loadHighlighter.pipe(
        Effect.andThen(({ highlightCode }) =>
          highlightCode({
            code: request.children,
            ...(request.language === undefined
              ? {}
              : { language: request.language }),
            ...(request.themes === undefined ? {} : { themes: request.themes }),
            transparentBackground: request.transparentBackground,
          })
        ),
        Effect.matchEffect({
          onFailure: (error) =>
            Effect.sync(() => {
              setHighlightedCode({ html: "", request });
              captureException(
                error._tag === "CodeHighlightError" ||
                  error._tag === "CodeHighlighterLoadError"
                  ? error.cause
                  : error,
                {
                  component: "CodeBlockContent",
                  language: request.language ?? "plain-text",
                  source: "code-block-highlight",
                }
              );
            }),
          onSuccess: (html) =>
            Effect.sync(() => {
              setHighlightedCode({ html, request });
            }),
        })
      )
    );

    return () => {
      Effect.runFork(Fiber.interrupt(fiber));
    };
  }, [request, serverHtml]);

  const html =
    serverHtml ??
    (highlightedCode.request === request ? highlightedCode.html : "");

  if (!(request.syntaxHighlighting && html)) {
    return <CodeBlockText {...props}>{children}</CodeBlockText>;
  }

  return (
    <div
      // biome-ignore lint/security/noDangerouslySetInnerHtml: Shiki returns the highlighted HTML rendered by this component.
      dangerouslySetInnerHTML={{ __html: html }}
      {...props}
    />
  );
}
