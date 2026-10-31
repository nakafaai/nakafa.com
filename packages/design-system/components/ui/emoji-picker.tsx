import { Search02Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { cn } from "cn";
import {
  type EmojiPickerListCategoryHeaderProps,
  type EmojiPickerListEmojiProps,
  type EmojiPickerListRowProps,
  EmojiPicker as EmojiPickerPrimitive,
} from "frimousse";
import type * as React from "react";
import { useTranslations } from "use-intl";

function EmojiPicker({
  className,
  ...props
}: React.ComponentProps<typeof EmojiPickerPrimitive.Root>) {
  return (
    <EmojiPickerPrimitive.Root
      className={cn(
        "bg-popover text-popover-foreground isolate flex h-full w-fit flex-col overflow-hidden rounded-md",
        className
      )}
      data-slot="emoji-picker"
      {...props}
    />
  );
}

function EmojiPickerSearch({
  className,
  ...props
}: React.ComponentProps<typeof EmojiPickerPrimitive.Search>) {
  return (
    <div
      className={cn("flex h-9 items-center gap-2 border-b px-3", className)}
      data-slot="emoji-picker-search-wrapper"
    >
      <HugeIcons
        aria-hidden="true"
        className="size-4 shrink-0 opacity-50"
        icon={Search02Icon}
      />
      <EmojiPickerPrimitive.Search
        className="placeholder:text-muted-foreground flex h-10 w-full rounded-md bg-transparent py-3 text-base outline-hidden disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
        data-slot="emoji-picker-search"
        {...props}
      />
    </div>
  );
}

function EmojiPickerRow({ children, ...props }: EmojiPickerListRowProps) {
  return (
    <div {...props} className="scroll-my-1 px-1" data-slot="emoji-picker-row">
      {children}
    </div>
  );
}

/** Renders one selectable emoji option inside the picker grid. */
function EmojiPickerEmoji({
  emoji,
  className,
  ...props
}: EmojiPickerListEmojiProps) {
  return (
    <button
      {...props}
      className={cn(
        "data-active:bg-accent flex size-7 items-center justify-center rounded-sm text-base",
        className
      )}
      data-slot="emoji-picker-emoji"
      type="button"
    >
      {emoji.emoji}
    </button>
  );
}

function EmojiPickerCategoryHeader({
  category,
  ...props
}: EmojiPickerListCategoryHeaderProps) {
  return (
    <div
      {...props}
      className="bg-popover text-muted-foreground px-3 pt-3.5 pb-2 text-xs leading-none"
      data-slot="emoji-picker-category-header"
    >
      {category.label}
    </div>
  );
}

function EmojiPickerContent({
  className,
  ...props
}: React.ComponentProps<typeof EmojiPickerPrimitive.Viewport>) {
  const t = useTranslations("Common");
  return (
    <EmojiPickerPrimitive.Viewport
      className={cn("relative flex-1 outline-hidden", className)}
      data-slot="emoji-picker-viewport"
      {...props}
    >
      <EmojiPickerPrimitive.Loading
        className="text-muted-foreground absolute inset-0 flex items-center justify-center"
        data-slot="emoji-picker-loading"
      >
        <Spinner className="size-4" label={t("loading")} />
      </EmojiPickerPrimitive.Loading>
      <EmojiPickerPrimitive.Empty
        className="text-muted-foreground absolute inset-0 flex items-center justify-center text-sm"
        data-slot="emoji-picker-empty"
      >
        {t("no-emoji-found")}
      </EmojiPickerPrimitive.Empty>
      <EmojiPickerPrimitive.List
        className="pb-1 select-none"
        components={{
          Row: EmojiPickerRow,
          Emoji: EmojiPickerEmoji,
          CategoryHeader: EmojiPickerCategoryHeader,
        }}
        data-slot="emoji-picker-list"
      />
    </EmojiPickerPrimitive.Viewport>
  );
}

function EmojiPickerFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const t = useTranslations("Common");
  return (
    <div
      className={cn(
        "flex w-full max-w-(--frimousse-viewport-width) min-w-0 items-center gap-1 border-t p-2",
        className
      )}
      data-slot="emoji-picker-footer"
      {...props}
    >
      <EmojiPickerPrimitive.ActiveEmoji>
        {({ emoji }) =>
          emoji ? (
            <>
              <div className="flex size-7 flex-none items-center justify-center text-lg">
                {emoji.emoji}
              </div>
              <span className="text-foreground min-w-0 text-xs text-pretty">
                {emoji.label}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground ml-1.5 flex min-h-7 items-center text-xs">
              {t("emoji-picker-placeholder")}
            </span>
          )
        }
      </EmojiPickerPrimitive.ActiveEmoji>
    </div>
  );
}

export {
  EmojiPicker,
  EmojiPickerContent,
  EmojiPickerFooter,
  EmojiPickerSearch,
};
