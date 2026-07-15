"use client";

import {
  Copy01Icon,
  Download01Icon,
  TerminalIcon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";
import { captureException } from "@repo/analytics/posthog";
import { CodeBlockContent } from "@repo/design-system/components/code-block/content";
import { codeBlockDarkModeVariants } from "@repo/design-system/components/code-block/variants";
import { SimpleIcon } from "@repo/design-system/components/icons/simple";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { writeCodeToClipboard } from "@repo/design-system/lib/code-block/clipboard";
import { languageIconMap } from "@repo/design-system/lib/code-block/icons";
import { getCodeFileExtension } from "@repo/design-system/lib/code-block/language-extension";
import { downloadFile } from "@repo/design-system/lib/files/download";
import { cn } from "@repo/design-system/lib/utils";
import { Effect } from "effect";
import {
  type ComponentProps,
  createContext,
  type HTMLAttributes,
  use,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { BundledTheme } from "shiki";

type CodeBlockProps = HTMLAttributes<HTMLDivElement> & {
  code: string;
  language: string;
  preClassName?: string;
};

interface CodeBlockContextType {
  code: string;
}

/** Provides the light theme first and the dark theme second. */
export const ShikiThemeContext = createContext<[BundledTheme, BundledTheme]>([
  "github-light",
  "github-dark",
]);

const CodeBlockContext = createContext<CodeBlockContextType>({
  code: "",
});

/** Renders highlighted code with paired light and dark Shiki themes. */
export const CodeBlock = ({
  code,
  language,
  className,
  children,
  preClassName,
  ...rest
}: CodeBlockProps) => {
  const [lightTheme, darkTheme] = use(ShikiThemeContext);
  const codeContextValue = useMemo(() => ({ code }), [code]);
  const codeThemes = useMemo(
    () => ({ dark: darkTheme, light: lightTheme }),
    [darkTheme, lightTheme]
  );

  const icon = languageIconMap[language];

  return (
    <CodeBlockContext.Provider value={codeContextValue}>
      <div
        className="my-4 w-full overflow-hidden rounded-xl border"
        data-code-block-container
        data-language={language}
      >
        <div
          className="flex items-center justify-between bg-muted/80 p-1 text-muted-foreground text-sm"
          data-code-block-header
          data-language={language}
        >
          <div className="flex items-center gap-2 px-4 py-1.5">
            {icon ? (
              <SimpleIcon className="size-4" icon={icon} />
            ) : (
              <HugeIcons className="size-4" icon={TerminalIcon} />
            )}
            <span className="font-mono lowercase">{language || "txt"}</span>
          </div>
          <div className="flex items-center">{children}</div>
        </div>
        <div className="w-full">
          <div className="min-w-full">
            <CodeBlockContent
              className={cn(
                codeBlockDarkModeVariants(),
                "overflow-x-auto",
                className
              )}
              data-code-block
              data-language={language}
              language={language}
              preClassName={preClassName}
              themes={codeThemes}
              transparentBackground
              {...rest}
            >
              {code}
            </CodeBlockContent>
          </div>
        </div>
      </div>
    </CodeBlockContext.Provider>
  );
};

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
export const CodeBlockDownloadButton = ({
  onDownload,
  onError,
  language,
  children,
  className,
  code: propCode,
  ...props
}: CodeBlockDownloadButtonProps & {
  code?: string;
  language?: string;
}) => {
  const contextCode = use(CodeBlockContext).code;
  const code = propCode ?? contextCode;
  const extension = getCodeFileExtension(language);
  const filename = `file.${extension}`;
  const mimeType = "text/plain";

  function downloadCode() {
    const program = downloadFile({ content: code, filename, mimeType }).pipe(
      Effect.match({
        onFailure: (error) => {
          captureException(error, {
            language: language ?? "plain-text",
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
};

/** Copies the current code sample and exposes a temporary success state. */
export const CodeBlockCopyButton = ({
  onCopy,
  onError,
  timeout = 2000,
  children,
  className,
  code: propCode,
  ...props
}: CodeBlockCopyButtonProps & { code?: string }) => {
  const [isCopied, setIsCopied] = useState(false);
  const timeoutRef = useRef(0);
  const contextCode = use(CodeBlockContext).code;
  const code = propCode ?? contextCode;

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
};
