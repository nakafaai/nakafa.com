"use client";

import { TerminalIcon } from "@hugeicons/core-free-icons";
import {
  type ProgrammingIcon,
  SimpleIcon,
} from "@repo/design-system/components/icons/simple";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import {
  type CodeBlockData,
  useCodeBlock,
} from "@repo/design-system/lib/code-block/context";
import { filenameIconMap } from "@repo/design-system/lib/code-block/icons";
import { cn } from "@repo/design-system/lib/utils";
import { useTranslations } from "next-intl";
import type { ComponentProps, HTMLAttributes, ReactNode } from "react";

/** Native toolbar attributes for the code-block header surface. */
export type CodeBlockHeaderProps = HTMLAttributes<HTMLDivElement>;

/** Renders the toolbar surface above a code block. */
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

/** Render-prop contract for projecting every source into the filename region. */
export type CodeBlockFilesProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "children"
> & {
  children: (item: CodeBlockData) => ReactNode;
};

/** Maps every source into the code block's filename region. */
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

/** Filename identity and optional icon override for one source. */
export type CodeBlockFilenameProps = HTMLAttributes<HTMLDivElement> & {
  icon?: ProgrammingIcon;
  value?: string;
};

/** Shows the filename and programming icon for the active source. */
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
  const iconValue = icon ?? defaultIcon;

  if (value !== activeValue) {
    return null;
  }

  return (
    <div
      className="flex min-w-0 items-center gap-2 px-4 py-1.5 text-muted-foreground text-sm"
      {...props}
    >
      {iconValue ? (
        <SimpleIcon className="size-4 shrink-0" icon={iconValue} />
      ) : (
        <HugeIcons className="size-4 shrink-0" icon={TerminalIcon} />
      )}
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </div>
  );
};

/** Select behavior bound to the active code source. */
export type CodeBlockSelectProps = ComponentProps<typeof Select>;

/** Binds a language selector to the code block's active source. */
export const CodeBlockSelect = (props: CodeBlockSelectProps) => {
  const { data, value, onValueChange } = useCodeBlock((state) => ({
    data: state.data,
    value: state.value,
    onValueChange: state.onValueChange,
  }));
  const items = data.map((item) => ({
    label: item.language,
    value: item.language,
  }));

  return (
    <Select
      items={items}
      onValueChange={(nextValue) => {
        if (typeof nextValue === "string") {
          onValueChange?.(nextValue);
        }
      }}
      value={value}
      {...props}
    />
  );
};

/** Trigger attributes for the compact language selector. */
export type CodeBlockSelectTriggerProps = ComponentProps<typeof SelectTrigger>;

/** Applies the compact code-block treatment to a select trigger. */
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

/** Value-slot attributes for the selected language label. */
export type CodeBlockSelectValueProps = ComponentProps<typeof SelectValue>;

/** Displays the selected code language inside its trigger. */
export const CodeBlockSelectValue = (props: CodeBlockSelectValueProps) => (
  <SelectValue {...props} />
);

/** Render-prop contract for projecting sources into language options. */
export type CodeBlockSelectContentProps = Omit<
  ComponentProps<typeof SelectContent>,
  "children"
> & {
  children: (item: CodeBlockData) => ReactNode;
};

/** Renders every available language inside the code-block select menu. */
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

/** Menu-item attributes for one selectable language. */
export type CodeBlockSelectItemProps = ComponentProps<typeof SelectItem>;

/** Applies the code-block typography to one language option. */
export const CodeBlockSelectItem = ({
  className,
  ...props
}: CodeBlockSelectItemProps) => (
  <SelectItem className={cn("text-sm", className)} {...props} />
);
