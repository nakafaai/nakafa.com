"use client";

import {
  Copy01Icon,
  Download01Icon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";
import { captureException } from "@repo/analytics/posthog/browser";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { writeCodeToClipboard } from "@repo/design-system/lib/code-block/clipboard";
import { getCodeFileExtension } from "@repo/design-system/lib/code-block/language-extension";
import { downloadFile } from "@repo/design-system/lib/files/download";
import { cn } from "cn";
import { Effect } from "effect";
import {
  type ComponentProps,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { createContext, useContextSelector } from "use-context-selector";

/** One code sample and the language it is written in. */
interface CodeSource {
  code: string;
  language: string;
}

const missingCodeSource = Symbol("missing-code-source");

const CodeSourceContext = createContext<CodeSource | typeof missingCodeSource>(
  missingCodeSource
);

/**
 * Shares one code sample with the copy and download controls composed in it.
 * The controls stay apart from the syntax highlighter, so a Mermaid card can
 * offer them without loading Shiki.
 */
export function CodeBlockSource({
  children,
  code,
  language,
}: CodeSource & { children: ReactNode }) {
  return (
    <CodeSourceContext.Provider value={{ code, language }}>
      {children}
    </CodeSourceContext.Provider>
  );
}

/** Selects one part of the surrounding code sample. */
function useCodeSource<T>(selector: (source: CodeSource) => T) {
  const selected = useContextSelector(CodeSourceContext, (value) =>
    value === missingCodeSource ? missingCodeSource : selector(value)
  );
  if (selected === missingCodeSource) {
    throw new Error("Code controls must be used within CodeBlockSource.");
  }
  return selected;
}

/** Copy-button callbacks and duration for its transient success state. */
export type CodeBlockCopyButtonProps = ComponentProps<"button"> & {
  onCopy?: () => void;
  onError?: (error: Error) => void;
  timeout?: number;
};

/** Download-button callbacks for the generated code file. */
export type CodeBlockDownloadButtonProps = ComponentProps<"button"> & {
  onDownload?: () => void;
  onError?: (error: Error) => void;
};

/** Downloads the current code sample with an extension derived from its language. */
export function CodeBlockDownloadButton({
  onDownload,
  onError,
  children,
  className,
  ...props
}: CodeBlockDownloadButtonProps) {
  const code = useCodeSource((source) => source.code);
  const language = useCodeSource((source) => source.language);
  const extension = getCodeFileExtension(language);
  const filename = `file.${extension}`;
  const mimeType = "text/plain";

  function downloadCode() {
    const program = downloadFile({ content: code, filename, mimeType }).pipe(
      Effect.match({
        onFailure: (error) => {
          captureException(error, {
            language,
            source: "ai-code-block-download",
          });
          onError?.(error);
        },
        onSuccess: () => onDownload?.(),
      })
    );

    Effect.runSync(program);
  }

  return (
    <Button
      className={cn("shrink-0", className)}
      onClick={downloadCode}
      size="icon"
      title="Download file"
      variant="ghost"
      {...props}
    >
      {children ?? (
        <HugeIcons className="size-4 shrink-0" icon={Download01Icon} />
      )}
    </Button>
  );
}

/** Copies the current code sample and exposes a temporary success state. */
export function CodeBlockCopyButton({
  onCopy,
  onError,
  timeout = 2000,
  children,
  className,
  ...props
}: CodeBlockCopyButtonProps) {
  const [isCopied, setIsCopied] = useState(false);
  const timeoutRef = useRef(0);
  const code = useCodeSource((source) => source.code);

  function copyToClipboard() {
    if (isCopied) {
      return;
    }

    const program = writeCodeToClipboard(
      globalThis.navigator?.clipboard,
      code
    ).pipe(
      Effect.match({
        onFailure: (error) => {
          const cause =
            error._tag === "CodeClipboardWriteError" ? error.cause : error;

          captureException(cause, {
            source: "ai-code-block-copy",
          });
          onError?.(error);
        },
        onSuccess: () => {
          setIsCopied(true);
          onCopy?.();
          timeoutRef.current = window.setTimeout(
            () => setIsCopied(false),
            timeout
          );
        },
      })
    );

    Effect.runFork(program);
  }

  useEffect(
    () => () => {
      window.clearTimeout(timeoutRef.current);
    },
    []
  );

  const icon = isCopied ? Tick01Icon : Copy01Icon;

  return (
    <Button
      className={cn("shrink-0", className)}
      onClick={copyToClipboard}
      size="icon"
      variant="ghost"
      {...props}
    >
      {children ?? <HugeIcons className="size-4 shrink-0" icon={icon} />}
    </Button>
  );
}
