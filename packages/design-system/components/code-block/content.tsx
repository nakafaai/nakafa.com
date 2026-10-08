"use client";

import { captureException } from "@repo/analytics/posthog/browser";
import { CodeBlockText } from "@repo/design-system/components/code-block/text";
import {
  type CodeHighlightOptions,
  highlightCode,
} from "@repo/design-system/lib/code-block/highlight";
import { Effect, Fiber, Schema } from "effect";
import type { HTMLAttributes } from "react";
import { useEffect, useMemo, useState } from "react";
import type { CodeOptionsMultipleThemes } from "shiki";

/** Highlighting options plus the exact source used by the text fallback. */
export type CodeBlockContentProps = HTMLAttributes<HTMLDivElement> & {
  children: string;
  language?: string;
  preClassName?: string | undefined;
  syntaxHighlighting?: boolean;
  themes?: CodeOptionsMultipleThemes["themes"];
  transparentBackground?: boolean;
};

const CodeHighlightRequestSchema = Schema.Struct({
  children: Schema.String,
  language: Schema.UndefinedOr(Schema.String),
  preClassName: Schema.UndefinedOr(Schema.String),
  syntaxHighlighting: Schema.Boolean,
  transparentBackground: Schema.Boolean,
});
type CodeHighlightRequest = typeof CodeHighlightRequestSchema.Type &
  Pick<CodeHighlightOptions, "themes">;

/** Highlights client-rendered code while retaining a safe text fallback. */
export function CodeBlockContent({
  children,
  themes,
  language,
  preClassName,
  syntaxHighlighting = true,
  transparentBackground = false,
  ...props
}: CodeBlockContentProps) {
  const request = useMemo<CodeHighlightRequest>(
    () => ({
      children,
      language,
      preClassName,
      syntaxHighlighting,
      themes,
      transparentBackground,
    }),
    [
      children,
      language,
      preClassName,
      syntaxHighlighting,
      themes,
      transparentBackground,
    ]
  );
  const [highlightedCode, setHighlightedCode] = useState<{
    html: string;
    request: CodeHighlightRequest | null;
  }>({
    html: "",
    request: null,
  });

  useEffect(() => {
    if (!request.syntaxHighlighting) {
      return;
    }

    const fiber = Effect.runFork(
      highlightCode({
        code: request.children,
        ...(request.language === undefined
          ? {}
          : { language: request.language }),
        preClassName: request.preClassName,
        ...(request.themes === undefined ? {} : { themes: request.themes }),
        transparentBackground: request.transparentBackground,
      }).pipe(
        Effect.matchEffect({
          onFailure: (error) =>
            Effect.sync(() => {
              setHighlightedCode({ html: "", request });
              captureException(
                error._tag === "CodeHighlightError" ? error.cause : error,
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
  }, [request]);

  const html = highlightedCode.request === request ? highlightedCode.html : "";

  if (!(request.syntaxHighlighting && html)) {
    return (
      <CodeBlockText preClassName={request.preClassName} {...props}>
        {children}
      </CodeBlockText>
    );
  }

  return (
    <div
      // biome-ignore lint/security/noDangerouslySetInnerHtml: Shiki returns the highlighted HTML rendered by this component.
      dangerouslySetInnerHTML={{ __html: html }}
      {...props}
    />
  );
}
