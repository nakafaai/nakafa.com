"use client";

import {
  SiAstro,
  SiC,
  SiCoffeescript,
  SiCplusplus,
  SiCss,
  SiDart,
  SiDocker,
  SiGnometerminal,
  SiGnubash,
  SiGo,
  SiGraphql,
  SiHandlebarsdotjs,
  SiHtml5,
  SiJavascript,
  SiJson,
  SiLess,
  SiMarkdown,
  SiMdx,
  SiMysql,
  SiPerl,
  SiPhp,
  SiPrisma,
  SiPug,
  SiPython,
  SiR,
  SiReact,
  SiRuby,
  SiSass,
  SiScala,
  SiSvelte,
  SiSvg,
  SiSwift,
  SiToml,
  SiTypescript,
  SiVuedotjs,
  SiWebassembly,
} from "@icons-pack/react-simple-icons";
import { Button } from "@repo/design-system/components/ui/button";
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

const languageIconMap = {
  astro: SiAstro,
  c: SiC,
  "c++": SiCplusplus,
  cpp: SiCplusplus,
  coffeescript: SiCoffeescript,
  css: SiCss,
  dart: SiDart,
  dockerfile: SiDocker,
  go: SiGo,
  graphql: SiGraphql,
  bash: SiGnubash,
  sh: SiGnubash,
  shell: SiGnubash,
  handlebars: SiHandlebarsdotjs,
  hbs: SiHandlebarsdotjs,
  html: SiHtml5,
  javascript: SiJavascript,
  js: SiJavascript,
  json: SiJson,
  less: SiLess,
  markdown: SiMarkdown,
  md: SiMarkdown,
  mdx: SiMdx,
  sql: SiMysql,
  mysql: SiMysql,
  perl: SiPerl,
  php: SiPhp,
  prisma: SiPrisma,
  pug: SiPug,
  python: SiPython,
  py: SiPython,
  r: SiR,
  ruby: SiRuby,
  rb: SiRuby,
  jsx: SiReact,
  tsx: SiReact,
  react: SiReact,
  sass: SiSass,
  scss: SiSass,
  scala: SiScala,
  svelte: SiSvelte,
  svg: SiSvg,
  swift: SiSwift,
  toml: SiToml,
  typescript: SiTypescript,
  ts: SiTypescript,
  vue: SiVuedotjs,
  wasm: SiWebassembly,
};

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

const MemoizedSyntaxHighlighter = memo(
  SyntaxHighlighter,
  (prevProps, nextProps) => {
    return prevProps.children === nextProps.children;
  }
);

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
            "grid size-full grid-cols-1 overflow-hidden rounded-md border shadow-sm",
            className
          )}
          {...props}
        >
          <div className="flex flex-row items-center border-b bg-accent p-1">
            <div className="flex min-w-0 items-center gap-2 bg-accent px-4 py-1.5 text-accent-foreground text-sm">
              <Icon className="size-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{language}</span>
            </div>
            <div className="ml-auto flex items-center gap-2 p-1">
              {children}
            </div>
          </div>

          <div className="relative">
            <MemoizedSyntaxHighlighter
              className="overflow-hidden dark:hidden"
              codeTagProps={{
                className: "font-mono text-sm",
              }}
              customStyle={{
                margin: 0,
                padding: "1rem",
                fontSize: "0.875rem",
                background: "hsl(var(--background))",
                color: "hsl(var(--foreground))",
              }}
              language={language}
              lineNumberStyle={{
                color: "hsl(var(--muted-foreground))",
                paddingRight: "1rem",
                minWidth: "2.5rem",
              }}
              showLineNumbers={showLineNumbers}
              style={oneLight}
            >
              {code}
            </MemoizedSyntaxHighlighter>
            <MemoizedSyntaxHighlighter
              className="hidden overflow-hidden dark:block"
              codeTagProps={{
                className: "font-mono text-sm",
              }}
              customStyle={{
                margin: 0,
                padding: "1rem",
                fontSize: "0.875rem",
                background: "hsl(var(--background))",
                color: "hsl(var(--foreground))",
              }}
              language={language}
              lineNumberStyle={{
                color: "hsl(var(--muted-foreground))",
                paddingRight: "1rem",
                minWidth: "2.5rem",
              }}
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
