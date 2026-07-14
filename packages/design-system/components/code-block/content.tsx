"use client";

import { captureException } from "@repo/analytics/posthog";
import { highlightCode } from "@repo/design-system/lib/code-block";
import { Effect, Fiber } from "effect";
import type { HTMLAttributes } from "react";
import { Fragment, useEffect, useMemo, useState } from "react";
import type { CodeOptionsMultipleThemes } from "shiki";

type CodeBlockFallbackProps = HTMLAttributes<HTMLDivElement>;

function CodeBlockFallback({ children, ...props }: CodeBlockFallbackProps) {
  const lines = children?.toString().split("\n") ?? [];

  return (
    <div {...props}>
      <pre className="w-full">
        <code>
          {lines.map((line, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: Line content may repeat, need index for uniqueness
            <Fragment key={`${index}-${line}`}>
              <span className="line">{line}</span>
              {index < lines.length - 1 ? "\n" : null}
            </Fragment>
          ))}
        </code>
      </pre>
    </div>
  );
}

export type CodeBlockContentProps = HTMLAttributes<HTMLDivElement> & {
  themes?: CodeOptionsMultipleThemes["themes"];
  language?: string;
  syntaxHighlighting?: boolean;
  children: string;
};

interface CodeHighlightRequest {
  children: string;
  language: string | undefined;
  syntaxHighlighting: boolean;
  themes: CodeOptionsMultipleThemes["themes"] | undefined;
}

/** Highlights client-rendered code while retaining a safe text fallback. */
export const CodeBlockContent = ({
  children,
  themes,
  language,
  syntaxHighlighting = true,
  ...props
}: CodeBlockContentProps) => {
  const request = useMemo<CodeHighlightRequest>(
    () => ({ children, language, syntaxHighlighting, themes }),
    [children, language, syntaxHighlighting, themes]
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
        language: request.language,
        themes: request.themes,
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
    return <CodeBlockFallback {...props}>{children}</CodeBlockFallback>;
  }

  return (
    <div
      // biome-ignore lint/security/noDangerouslySetInnerHtml: Shiki returns the highlighted HTML rendered by this component.
      dangerouslySetInnerHTML={{ __html: html }}
      {...props}
    />
  );
};
