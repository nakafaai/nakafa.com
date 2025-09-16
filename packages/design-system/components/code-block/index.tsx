"use client";

import { type IconType, SiGnometerminal } from "@icons-pack/react-simple-icons";
import { useControllableState } from "@radix-ui/react-use-controllable-state";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { filenameIconMap } from "@repo/design-system/lib/programming";
import { cn } from "@repo/design-system/lib/utils";
import {
  transformerNotationDiff,
  transformerNotationErrorLevel,
  transformerNotationFocus,
  transformerNotationHighlight,
  transformerNotationWordHighlight,
} from "@shikijs/transformers";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type {
  ComponentProps,
  HTMLAttributes,
  ReactElement,
  ReactNode,
} from "react";
import { cloneElement, useEffect, useState } from "react";
import {
  type BundledLanguage,
  type CodeOptionsMultipleThemes,
  codeToHtml,
} from "shiki";
import { createContext, useContextSelector } from "use-context-selector";

export type { BundledLanguage } from "shiki";

const lineNumberClassNames = cn(
  "[&_code]:[counter-reset:line]",
  "[&_code]:[counter-increment:line_0]",
  "[&_.line]:before:content-[counter(line)]",
  "[&_.line]:before:inline-block",
  "[&_.line]:before:[counter-increment:line]",
  "[&_.line]:before:w-4",
  "[&_.line]:before:mr-4",
  "[&_.line]:before:text-[13px]",
  "[&_.line]:before:text-right",
  "[&_.line]:before:text-muted-foreground/50",
  "[&_.line]:before:font-mono",
  "[&_.line]:before:select-none"
);

const darkModeClassNames = cn(
  "dark:[&_.shiki]:!text-[var(--shiki-dark)]",
  "dark:[&_.shiki]:![font-style:var(--shiki-dark-font-style)]",
  "dark:[&_.shiki]:![font-weight:var(--shiki-dark-font-weight)]",
  "dark:[&_.shiki]:![text-decoration:var(--shiki-dark-text-decoration)]",
  "dark:[&_.shiki_span]:!text-[var(--shiki-dark)]",
  "dark:[&_.shiki_span]:![font-style:var(--shiki-dark-font-style)]",
  "dark:[&_.shiki_span]:![font-weight:var(--shiki-dark-font-weight)]",
  "dark:[&_.shiki_span]:![text-decoration:var(--shiki-dark-text-decoration)]"
);

const lineHighlightClassNames = cn(
  "[&_.line.highlighted]:bg-blue-50",
  "[&_.line.highlighted]:after:bg-blue-500",
  "[&_.line.highlighted]:after:absolute",
  "[&_.line.highlighted]:after:left-0",
  "[&_.line.highlighted]:after:top-0",
  "[&_.line.highlighted]:after:bottom-0",
  "[&_.line.highlighted]:after:w-0.5",
  "dark:[&_.line.highlighted]:!bg-blue-500/10"
);

const lineDiffClassNames = cn(
  "[&_.line.diff]:after:absolute",
  "[&_.line.diff]:after:left-0",
  "[&_.line.diff]:after:top-0",
  "[&_.line.diff]:after:bottom-0",
  "[&_.line.diff]:after:w-0.5",
  "[&_.line.diff.add]:bg-emerald-50",
  "[&_.line.diff.add]:after:bg-emerald-500",
  "[&_.line.diff.remove]:bg-rose-50",
  "[&_.line.diff.remove]:after:bg-rose-500",
  "dark:[&_.line.diff.add]:!bg-emerald-500/10",
  "dark:[&_.line.diff.remove]:!bg-rose-500/10"
);

const lineFocusedClassNames = cn(
  "[&_code:has(.focused)_.line]:blur-[2px]",
  "[&_code:has(.focused)_.line.focused]:blur-none"
);

const wordHighlightClassNames = cn(
  "[&_.highlighted-word]:bg-blue-50",
  "dark:[&_.highlighted-word]:!bg-blue-500/10"
);

const codeBlockClassName = cn(
  "mt-0 bg-muted/40 text-sm",
  "[&_pre]:py-4",
  "[&_pre]:overflow-x-auto",
  "[&_.shiki]:!bg-[var(--shiki-bg)]",
  "[&_code]:w-full",
  "[&_code]:grid",
  "[&_code]:bg-transparent",
  "[&_.line]:px-4",
  "[&_.line]:w-full",
  "[&_.line]:relative"
);

const highlight = (
  html: string,
  language?: BundledLanguage,
  themes?: CodeOptionsMultipleThemes["themes"]
) =>
  codeToHtml(html, {
    lang: language ?? "typescript",
    themes: themes ?? {
      light: "github-light",
      dark: "github-dark-default",
    },
    transformers: [
      transformerNotationDiff({
        matchAlgorithm: "v3",
      }),
      transformerNotationHighlight({
        matchAlgorithm: "v3",
      }),
      transformerNotationWordHighlight({
        matchAlgorithm: "v3",
      }),
      transformerNotationFocus({
        matchAlgorithm: "v3",
      }),
      transformerNotationErrorLevel({
        matchAlgorithm: "v3",
      }),
    ],
  });

export type CodeBlockData = {
  language: string;
  filename: string;
  code: string;
};

type CodeBlockContextType = {
  value: string | undefined;
  onValueChange: ((value: string) => void) | undefined;
  data: CodeBlockData[];
};

const CodeBlockContext = createContext<CodeBlockContextType>({
  value: undefined,
  onValueChange: undefined,
  data: [],
});

function useCodeBlock<T>(selector: (state: CodeBlockContextType) => T): T {
  const ctx = useContextSelector(CodeBlockContext, (context) => context);
  if (!ctx) {
    throw new Error("CodeBlock components must be used within CodeBlock");
  }
  return selector(ctx);
}

export type CodeBlockProps = HTMLAttributes<HTMLDivElement> & {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  data: CodeBlockData[];
};

export const CodeBlock = ({
  value: controlledValue,
  onValueChange: controlledOnValueChange,
  defaultValue,
  className,
  data,
  ...props
}: CodeBlockProps) => {
  const [value, onValueChange] = useControllableState({
    defaultProp: defaultValue ?? "",
    prop: controlledValue,
    onChange: controlledOnValueChange,
  });

  return (
    <CodeBlockContext.Provider value={{ value, onValueChange, data }}>
      <div
        className={cn(
          "grid size-full grid-cols-1 overflow-hidden rounded-xl border shadow-sm",
          className
        )}
        {...props}
      />
    </CodeBlockContext.Provider>
  );
};

export type CodeBlockHeaderProps = HTMLAttributes<HTMLDivElement>;

export const CodeBlockHeader = ({
  className,
  ...props
}: CodeBlockHeaderProps) => (
  <div
    className={cn(
      "flex flex-row items-center border-b bg-muted/80 p-1",
      className
    )}
    {...props}
  />
);

export type CodeBlockFilesProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "children"
> & {
  children: (item: CodeBlockData) => ReactNode;
};

export const CodeBlockFiles = ({
  className,
  children,
  ...props
}: CodeBlockFilesProps) => {
  const data = useCodeBlock((state) => state.data);

  return (
    <div
      className={cn("flex min-w-0 grow flex-row items-center gap-2", className)}
      {...props}
    >
      {data.map(children)}
    </div>
  );
};

export type CodeBlockFilenameProps = HTMLAttributes<HTMLDivElement> & {
  icon?: IconType;
  value?: string;
};

export const CodeBlockFilename = ({
  className,
  icon,
  value,
  children,
  ...props
}: CodeBlockFilenameProps) => {
  const activeValue = useCodeBlock((state) => state.value);
  const defaultIcon = Object.entries(filenameIconMap).find(([pattern]) => {
    const regex = new RegExp(
      `^${pattern.replace(/\\/g, "\\\\").replace(/\./g, "\\.").replace(/\*/g, ".*")}$`
    );
    return regex.test(children?.toString() ?? "");
  })?.[1];
  const Icon = icon ?? defaultIcon ?? SiGnometerminal;

  if (value !== activeValue) {
    return null;
  }

  return (
    <div
      className="flex min-w-0 items-center gap-2 px-4 py-1.5 text-muted-foreground text-sm"
      {...props}
    >
      {Icon && <Icon className="size-4 shrink-0" />}
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </div>
  );
};

export type CodeBlockSelectProps = ComponentProps<typeof Select>;

export const CodeBlockSelect = (props: CodeBlockSelectProps) => {
  const { value, onValueChange } = useCodeBlock((state) => ({
    value: state.value,
    onValueChange: state.onValueChange,
  }));

  return <Select onValueChange={onValueChange} value={value} {...props} />;
};

export type CodeBlockSelectTriggerProps = ComponentProps<typeof SelectTrigger>;

export const CodeBlockSelectTrigger = ({
  className,
  ...props
}: CodeBlockSelectTriggerProps) => (
  <SelectTrigger
    className={cn(
      "w-fit border-none text-muted-foreground text-sm shadow-none",
      className
    )}
    size="sm"
    {...props}
  />
);

export type CodeBlockSelectValueProps = ComponentProps<typeof SelectValue>;

export const CodeBlockSelectValue = (props: CodeBlockSelectValueProps) => (
  <SelectValue {...props} />
);

export type CodeBlockSelectContentProps = Omit<
  ComponentProps<typeof SelectContent>,
  "children"
> & {
  children: (item: CodeBlockData) => ReactNode;
};

export const CodeBlockSelectContent = ({
  children,
  ...props
}: CodeBlockSelectContentProps) => {
  const t = useTranslations("Common");
  const data = useCodeBlock((state) => state.data);

  return (
    <SelectContent {...props}>
      <SelectGroup>
        <SelectLabel>{t("language")}</SelectLabel>
        {data.map(children)}
      </SelectGroup>
    </SelectContent>
  );
};

export type CodeBlockSelectItemProps = ComponentProps<typeof SelectItem>;

export const CodeBlockSelectItem = ({
  className,
  ...props
}: CodeBlockSelectItemProps) => (
  <SelectItem className={cn("text-sm", className)} {...props} />
);

export type CodeBlockCopyButtonProps = ComponentProps<typeof Button> & {
  onCopy?: () => void;
  onError?: (error: Error) => void;
  timeout?: number;
};

export const CodeBlockCopyButton = ({
  asChild,
  onCopy,
  onError,
  timeout = 2000,
  children,
  className,
  ...props
}: CodeBlockCopyButtonProps) => {
  const [isCopied, setIsCopied] = useState(false);
  const { data, value } = useCodeBlock((state) => ({
    data: state.data,
    value: state.value,
  }));
  const code = data.find((item) => item.language === value)?.code;

  const copyToClipboard = () => {
    if (
      typeof window === "undefined" ||
      !navigator.clipboard.writeText ||
      !code
    ) {
      return;
    }

    navigator.clipboard.writeText(code).then(() => {
      setIsCopied(true);
      onCopy?.();

      setTimeout(() => setIsCopied(false), timeout);
    }, onError);
  };

  if (asChild) {
    return cloneElement(children as ReactElement, {
      // @ts-expect-error - we know this is a button
      onClick: copyToClipboard,
    });
  }

  const Icon = isCopied ? CheckIcon : CopyIcon;

  return (
    <Button
      className={cn("shrink-0", className)}
      onClick={copyToClipboard}
      size="icon"
      variant="ghost"
      {...props}
    >
      {children ?? <Icon className="text-muted-foreground" size={14} />}
    </Button>
  );
};

type CodeBlockFallbackProps = HTMLAttributes<HTMLDivElement>;

const CodeBlockFallback = ({ children, ...props }: CodeBlockFallbackProps) => (
  <div {...props}>
    <pre className="w-full">
      <code>
        {children
          ?.toString()
          .split("\n")
          .map((line, i) => (
            <span className="line" key={`${i}-${line}`}>
              {line}
            </span>
          ))}
      </code>
    </pre>
  </div>
);

export type CodeBlockBodyProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "children"
> & {
  children: (item: CodeBlockData) => ReactNode;
};

export const CodeBlockBody = ({ children, ...props }: CodeBlockBodyProps) => {
  const data = useCodeBlock((state) => state.data);

  return <div {...props}>{data.map(children)}</div>;
};

export type CodeBlockItemProps = HTMLAttributes<HTMLDivElement> & {
  value: string;
  lineNumbers?: boolean;
};

export const CodeBlockItem = ({
  children,
  lineNumbers = true,
  className,
  value,
  ...props
}: CodeBlockItemProps) => {
  const activeValue = useCodeBlock((state) => state.value);

  if (value !== activeValue) {
    return null;
  }

  return (
    <div
      className={cn(
        codeBlockClassName,
        lineHighlightClassNames,
        lineDiffClassNames,
        lineFocusedClassNames,
        wordHighlightClassNames,
        darkModeClassNames,
        lineNumbers && lineNumberClassNames,
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export type CodeBlockContentProps = HTMLAttributes<HTMLDivElement> & {
  themes?: CodeOptionsMultipleThemes["themes"];
  language?: BundledLanguage;
  syntaxHighlighting?: boolean;
  children: string;
};

export const CodeBlockContent = ({
  children,
  themes,
  language,
  syntaxHighlighting = true,
  ...props
}: CodeBlockContentProps) => {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    if (!syntaxHighlighting) {
      return;
    }

    highlight(children, language, themes)
      .then(setHtml)
      // biome-ignore lint/suspicious/noConsole: "it's fine"
      .catch(console.error);
  }, [children, themes, syntaxHighlighting, language]);

  if (!(syntaxHighlighting && html)) {
    return <CodeBlockFallback>{children}</CodeBlockFallback>;
  }

  return (
    <div
      // biome-ignore lint/security/noDangerouslySetInnerHtml: "Kinda how Shiki works"
      dangerouslySetInnerHTML={{ __html: html }}
      {...props}
    />
  );
};
