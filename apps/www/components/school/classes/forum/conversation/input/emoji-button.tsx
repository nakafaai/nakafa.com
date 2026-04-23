import { WinkIcon } from "@hugeicons/core-free-icons";
import {
  EmojiPicker,
  EmojiPickerContent,
  EmojiPickerFooter,
  EmojiPickerSearch,
} from "@repo/design-system/components/ui/emoji-picker";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { InputGroupButton } from "@repo/design-system/components/ui/input-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { Activity, memo } from "react";

/** Renders the emoji picker trigger for the forum composer. */
export const EmojiButton = memo(
  ({
    isMobile,
    isOpen,
    isSubmitting,
    label,
    onAppendEmoji,
    onOpenChange,
  }: {
    isMobile: boolean;
    isOpen: boolean;
    isSubmitting: boolean;
    label: string;
    onAppendEmoji: (emoji: string) => void;
    onOpenChange: (open: boolean) => void;
  }) => (
    <Popover onOpenChange={onOpenChange} open={isOpen}>
      <PopoverTrigger asChild>
        <InputGroupButton
          aria-label={label}
          disabled={isSubmitting}
          size="icon"
          type="button"
          variant="ghost"
        >
          <Activity mode={isMobile ? "hidden" : "visible"}>
            <Spinner icon={WinkIcon} isLoading={isSubmitting} />
          </Activity>
          <Activity mode={isMobile ? "visible" : "hidden"}>
            <HugeIcons icon={WinkIcon} />
          </Activity>
          <span className="sr-only">{label}</span>
        </InputGroupButton>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-fit p-0">
        <EmojiPicker
          className="h-80"
          onEmojiSelect={({ emoji }) => onAppendEmoji(emoji)}
        >
          <EmojiPickerSearch />
          <EmojiPickerContent />
          <EmojiPickerFooter />
        </EmojiPicker>
      </PopoverContent>
    </Popover>
  )
);
EmojiButton.displayName = "EmojiButton";
