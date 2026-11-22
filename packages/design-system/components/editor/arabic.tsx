import { KeyboardIcon } from "@hugeicons/core-free-icons";
import { ArabicKeypad } from "@repo/design-system/components/ui/arabic";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import { useCurrentEditor } from "@tiptap/react";
import { useEffect, useState } from "react";

/**
 * The toolbar control that opens the Arabic keypad under the toolbar. A key types into the text at
 * its caret, and the keypad stays open while the writer moves the caret in the text, so a word can be
 * written letter by letter with its harakat. It closes from its control, Escape in the text or the keypad, or a
 * press outside the text and the keypad.
 */
export function EditorArabicKeyboard({ label }: { label: string }) {
  const { editor } = useCurrentEditor();
  const [open, setOpen] = useState(false);

  // The focus stays in the text while the keypad is open, and ProseMirror takes every Escape there as its own
  // (`preventDefault`), which a popup reads as handled already. So the text's own Escape closes the keypad.
  useEffect(() => {
    if (!open || editor === null) {
      return;
    }
    const text = editor.view.dom;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.isComposing) {
        setOpen(false);
      }
    };
    text.addEventListener("keydown", closeOnEscape);
    return () => text.removeEventListener("keydown", closeOnEscape);
  }, [editor, open]);

  return (
    <Popover
      onOpenChange={(next, details) => {
        const inText =
          details.reason === "outside-press" &&
          details.event?.target instanceof Node &&
          editor?.view.dom.contains(details.event.target) === true;
        if (!inText) {
          setOpen(next);
        }
      }}
      open={open}
      presentation="popover"
    >
      <PopoverTrigger
        render={
          <Button
            aria-pressed={open}
            className="aria-pressed:bg-accent aria-pressed:text-accent-foreground"
            onMouseDown={(event) => event.preventDefault()}
            size="icon-sm"
            tooltip={label}
            type="button"
            variant="ghost"
          />
        }
      >
        <HugeIcons icon={KeyboardIcon} />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-auto max-w-(--available-width) p-2"
        finalFocus="none"
        initialFocus="none"
      >
        <ArabicKeypad
          onKey={(text) => editor?.chain().focus().insertContent(text).run()}
        />
      </PopoverContent>
    </Popover>
  );
}
