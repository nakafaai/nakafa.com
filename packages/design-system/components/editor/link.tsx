"use client";

import { Link01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Input } from "@repo/design-system/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import { useCurrentEditor } from "@tiptap/react";
import { String as Str } from "effect";
import { useState } from "react";

/**
 * The control that turns the selected words into a link. It opens a small
 * field for the address: Enter keeps it, and an empty address removes the
 * link.
 */
export function RichEditorLink({
  active,
  label,
  placeholder,
}: {
  active: boolean;
  label: string;
  placeholder: string;
}) {
  const { editor } = useCurrentEditor();
  const [open, setOpen] = useState(false);
  const [href, setHref] = useState("");

  /** Opens with the address of the link the caret sits in, or with none. */
  function change(next: boolean) {
    if (next) {
      const current: unknown = editor?.getAttributes("link").href;
      setHref(typeof current === "string" ? current : "");
    }
    setOpen(next);
  }

  /** Links the selected words to the address, or removes their link when it is empty. */
  function apply() {
    const address = Str.trim(href);
    const selection = editor?.chain().focus().extendMarkRange("link");

    if (Str.isEmpty(address)) {
      selection?.unsetLink().run();
    } else {
      selection?.setLink({ href: address }).run();
    }

    setOpen(false);
  }

  return (
    <Popover onOpenChange={change} open={open}>
      <PopoverTrigger
        render={
          <Button
            aria-label={label}
            aria-pressed={active}
            className="aria-pressed:bg-accent aria-pressed:text-accent-foreground"
            size="icon-sm"
            title={label}
            type="button"
            variant="ghost"
          />
        }
      >
        <HugeIcons icon={Link01Icon} />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            apply();
          }}
        >
          <Input
            aria-label={label}
            autoFocus
            onChange={(event) => setHref(event.target.value)}
            placeholder={placeholder}
            type="url"
            value={href}
          />
        </form>
      </PopoverContent>
    </Popover>
  );
}
