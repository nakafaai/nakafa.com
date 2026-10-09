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
import { cn } from "cn";
import { Array as Arr, Option, Record as Rec } from "effect";
import { useTranslations } from "next-intl";
import type { ComponentProps, HTMLAttributes, ReactNode } from "react";

/** Native toolbar attributes for the code-block header surface. */
type CodeBlockHeaderProps = HTMLAttributes<HTMLDivElement>;

/** Renders the toolbar surface above a code block. */
export function CodeBlockHeader({ className, ...props }: CodeBlockHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-row items-center border-b bg-muted/80 p-1",
        className
      )}
      {...props}
    />
  );
}

/** Render-prop contract for projecting every source into the filename region. */
type CodeBlockFilesProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  children: (item: CodeBlockData) => ReactNode;
};

/** Maps every source into the code block's filename region. */
export function CodeBlockFiles({
  className,
  children,
  ...props
}: CodeBlockFilesProps) {
  const data = useCodeBlock((state) => state.data);

  return (
    <div
      className={cn("flex min-w-0 grow flex-row items-center gap-2", className)}
      {...props}
    >
      {Arr.map(data, children)}
    </div>
  );
}

/** Filename identity and optional icon override for one source. */
type CodeBlockFilenameProps = HTMLAttributes<HTMLDivElement> & {
  icon?: ProgrammingIcon;
  value?: string;
};

/** Shows the filename and programming icon for the active source. */
export function CodeBlockFilename({
  className,
  icon,
  value,
  children,
  ...props
}: CodeBlockFilenameProps) {
  const activeValue = useCodeBlock((state) => state.value);
  const defaultIcon = Option.getOrUndefined(
    Arr.findFirst(Rec.toEntries(filenameIconMap), ([pattern]) => {
      const regex = new RegExp(
        `^${pattern.replace(/\\/g, "\\\\").replace(/\./g, "\\.").replace(/\*/g, ".*")}$`
      );
      return regex.test(children?.toString() ?? "");
    })
  )?.[1];
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
}

/** Select behavior bound to the active code source. */
type CodeBlockSelectProps = ComponentProps<typeof Select>;

/** Binds a language selector to the code block's active source. */
export function CodeBlockSelect(props: CodeBlockSelectProps) {
  const data = useCodeBlock((state) => state.data);
  const value = useCodeBlock((state) => state.value);
  const onValueChange = useCodeBlock((state) => state.onValueChange);
  const items = Arr.map(data, (item) => ({
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
}

/** Trigger attributes for the compact language selector. */
type CodeBlockSelectTriggerProps = ComponentProps<typeof SelectTrigger>;

/** Applies the compact code-block treatment to a select trigger. */
export function CodeBlockSelectTrigger({
  className,
  ...props
}: CodeBlockSelectTriggerProps) {
  return (
    <SelectTrigger
      className={cn(
        "w-fit border-none text-muted-foreground text-sm shadow-none",
        className
      )}
      size="sm"
      {...props}
    />
  );
}

/** Value-slot attributes for the selected language label. */
type CodeBlockSelectValueProps = ComponentProps<typeof SelectValue>;

/** Displays the selected code language inside its trigger. */
export function CodeBlockSelectValue(props: CodeBlockSelectValueProps) {
  return <SelectValue {...props} />;
}

/** Render-prop contract for projecting sources into language options. */
type CodeBlockSelectContentProps = Omit<
  ComponentProps<typeof SelectContent>,
  "children"
> & {
  children: (item: CodeBlockData) => ReactNode;
};

/** Renders every available language inside the code-block select menu. */
export function CodeBlockSelectContent({
  children,
  ...props
}: CodeBlockSelectContentProps) {
  const t = useTranslations("Common");
  const data = useCodeBlock((state) => state.data);

  return (
    <SelectContent {...props}>
      <SelectGroup>
        <SelectLabel>{t("language")}</SelectLabel>
        {Arr.map(data, children)}
      </SelectGroup>
    </SelectContent>
  );
}

/** Menu-item attributes for one selectable language. */
type CodeBlockSelectItemProps = ComponentProps<typeof SelectItem>;

/** Applies the code-block typography to one language option. */
export function CodeBlockSelectItem({
  className,
  ...props
}: CodeBlockSelectItemProps) {
  return <SelectItem className={cn("text-sm", className)} {...props} />;
}
