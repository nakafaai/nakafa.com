"use client";

import { SiGnometerminal } from "@icons-pack/react-simple-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { languageIconMap } from "@repo/design-system/lib/programming";
import { cn } from "@repo/design-system/lib/utils";
import { CheckIcon, CopyIcon } from "lucide-react";
import type { ComponentProps, HTMLAttributes, ReactNode } from "react";
import { memo, useMemo, useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  oneDark,
  oneLight,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import { createContext, useContextSelector } from "use-context-selector";

type CodeBlockContextType = {
  code: string;
};

const CodeBlockContext = createContext<CodeBlockContextType>({
  code: "",
});

function CodeBlockContextProvider({
  code,
  children,
}: {
  code: string;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ code }), [code]);

  return (
    <CodeBlockContext.Provider value={value}>
      {children}
    </CodeBlockContext.Provider>
  );
}

function useCodeBlock<T>(selector: (state: CodeBlockContextType) => T): T {
  const ctx = useContextSelector(CodeBlockContext, (context) => context);
  if (!ctx) {
    throw new Error(
      "useCodeBlock must be used within a CodeBlockContextProvider"
    );
  }
  return selector(ctx);
}

export type CodeBlockProps = HTMLAttributes<HTMLDivElement> & {
  code: string;
  language: string;
  showLineNumbers?: boolean;
  children?: ReactNode;
};

// Extract styles to prevent inline object creation
const LIGHT_CUSTOM_STYLE = {
  margin: 0,
  padding: "1rem",
  fontSize: "0.875rem",
  background: "hsl(var(--background))",
  color: "hsl(var(--foreground))",
  borderRadius: "0",
};

const DARK_CUSTOM_STYLE = {
  margin: 0,
  padding: "1rem",
  fontSize: "0.875rem",
  background: "hsl(var(--background))",
  color: "hsl(var(--foreground))",
  borderRadius: "0",
};

const LINE_NUMBER_STYLE = {
  color: "hsl(var(--muted-foreground))",
  paddingRight: "1rem",
  minWidth: "2rem",
};

const CODE_TAG_PROPS = {
  className: "font-mono text-sm",
};

const MemoizedSyntaxHighlighter = memo(
  SyntaxHighlighter,
  (prevProps, nextProps) => {
    return prevProps.children === nextProps.children;
  }
);
MemoizedSyntaxHighlighter.displayName = "MemoizedSyntaxHighlighter";

export const CodeBlock = memo(
  ({
    code,
    language,
    showLineNumbers = false,
    className,
    children,
    ...props
  }: CodeBlockProps) => {
    const Icon = useMemo(
      () =>
        languageIconMap[
          language.toLowerCase() as keyof typeof languageIconMap
        ] ?? SiGnometerminal,
      [language]
    );

    return (
      <CodeBlockContextProvider code={code}>
        <div
          className={cn(
            "my-4 grid size-full grid-cols-1 overflow-hidden rounded-md border shadow-sm",
            className
          )}
          {...props}
        >
          <div className="flex flex-row items-center border-b bg-accent p-1">
            <div className="flex min-w-0 items-center gap-2 bg-accent px-4 py-1.5 text-accent-foreground text-sm">
              <Icon className="size-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{language}</span>
            </div>
            <div className="ml-auto flex items-center gap-2">{children}</div>
          </div>

          <div className="relative">
            <MemoizedSyntaxHighlighter
              className="overflow-hidden dark:hidden"
              codeTagProps={CODE_TAG_PROPS}
              customStyle={LIGHT_CUSTOM_STYLE}
              language={language}
              lineNumberStyle={LINE_NUMBER_STYLE}
              showLineNumbers={showLineNumbers}
              style={oneLight}
            >
              {code}
            </MemoizedSyntaxHighlighter>
            <MemoizedSyntaxHighlighter
              className="hidden overflow-hidden dark:block"
              codeTagProps={CODE_TAG_PROPS}
              customStyle={DARK_CUSTOM_STYLE}
              language={language}
              lineNumberStyle={LINE_NUMBER_STYLE}
              showLineNumbers={showLineNumbers}
              style={oneDark}
            >
              {code}
            </MemoizedSyntaxHighlighter>
          </div>
        </div>
      </CodeBlockContextProvider>
    );
  },
  (prevProps, nextProps) => {
    return prevProps.code === nextProps.code;
  }
);

export type CodeBlockCopyButtonProps = ComponentProps<typeof Button> & {
  onCopy?: () => void;
  onError?: (error: Error) => void;
  timeout?: number;
};

export const CodeBlockCopyButton = memo(
  ({
    onCopy,
    onError,
    timeout = 2000,
    children,
    className,
    ...props
  }: CodeBlockCopyButtonProps) => {
    const [isCopied, setIsCopied] = useState(false);
    const code = useCodeBlock((state) => state.code);

    const copyToClipboard = async () => {
      if (typeof window === "undefined" || !navigator.clipboard.writeText) {
        onError?.(new Error("Clipboard API not available"));
        return;
      }

      try {
        await navigator.clipboard.writeText(code);
        setIsCopied(true);
        onCopy?.();
        setTimeout(() => setIsCopied(false), timeout);
      } catch (error) {
        onError?.(error as Error);
      }
    };

    const Icon = isCopied ? CheckIcon : CopyIcon;

    return (
      <Button
        className={cn("shrink-0", className)}
        onClick={copyToClipboard}
        size="icon"
        variant="ghost"
        {...props}
      >
        {children ?? <Icon className="text-accent-foreground" size={14} />}
      </Button>
    );
  }
);
