import { KeyboardIcon } from "@hugeicons/core-free-icons";
import { ToolHint } from "@repo/design-system/components/editor/tip";
import { ArabicKeypad } from "@repo/design-system/components/ui/arabic";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import { useCurrentEditor } from "@tiptap/react";
import { useState } from "react";

/**
 * The toolbar control that opens the Arabic keypad under the toolbar. A key types into the text at
 * its caret, and the keypad stays open while the writer moves the caret in the text, so a word can be
 * written letter by letter with its harakat. It closes from its control, Escape, or a press outside
 * the text and the keypad.
 */
export function EditorArabicKeyboard({ label }: { label: string }) {
  const { editor } = useCurrentEditor();
  const [open, setOpen] = useState(false);

  return (
    <Popover
      onOpenChange={(next, details) => {
        const inText =
          details.reason === "outside-press" &&
          details.event.target instanceof Node &&
          editor?.view.dom.contains(details.event.target) === true;
        if (!inText) {
          setOpen(next);
        }
      }}
      open={open}
    >
      <ToolHint label={label}>
        <PopoverTrigger
          render={
            <Button
              aria-label={label}
              aria-pressed={open}
              className="aria-pressed:bg-accent aria-pressed:text-accent-foreground"
              onMouseDown={(event) => event.preventDefault()}
              size="icon-sm"
              type="button"
              variant="ghost"
            />
          }
        >
          <HugeIcons icon={KeyboardIcon} />
        </PopoverTrigger>
      </ToolHint>
      <PopoverContent
        align="end"
        className="w-auto p-2"
        finalFocus={false}
        initialFocus={false}
      >
        <ArabicKeypad
          onKey={(text) => editor?.chain().focus().insertContent(text).run()}
        />
      </PopoverContent>
    </Popover>
  );
}
