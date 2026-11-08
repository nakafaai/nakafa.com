import { Link01Icon } from "@hugeicons/core-free-icons";
import { ToolHint } from "@repo/design-system/components/editor/tip";
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

/** The start of an address that names its scheme, such as `https:` or `mailto:`. */
const SCHEME = /^[a-z][a-z\d+.-]*:/iu;

/**
 * The address a writer typed, as the link takes it: an address with no scheme, such as `nakafa.com`,
 * is a web address, so it takes `https://`, the one scheme every editor's links accept.
 */
const linkAddress = (typed: string) =>
  SCHEME.test(typed) ? typed : `https://${typed}`;

/**
 * The control that turns the selected words into a link. It opens a small
 * field for the address: Enter keeps it, and an empty address removes the
 * link. An address with no scheme links to its https address. An address the
 * editor's links refuse, such as one that is not https in an exam, keeps the
 * field open with `invalid` under it, so the writer sees why nothing was linked.
 */
export function RichEditorLink({
  active,
  invalid,
  label,
  placeholder,
}: {
  active: boolean;
  /** The sentence under the field when the editor refuses the address. */
  invalid: string;
  label: string;
  placeholder: string;
}) {
  const { editor } = useCurrentEditor();
  const [open, setOpen] = useState(false);
  const [href, setHref] = useState("");
  const [refused, setRefused] = useState(false);

  /** Opens with the address of the link the caret sits in, or with none. */
  function change(next: boolean) {
    if (next) {
      const current: unknown = editor?.getAttributes("link").href;
      setHref(typeof current === "string" ? current : "");
      setRefused(false);
    }
    setOpen(next);
  }

  /**
   * Links the selected words to the address, or removes their link when it is empty. An address the
   * editor refuses keeps the focus in the field, with the reason under it.
   */
  function apply() {
    const address = Str.trim(href);

    if (Str.isEmpty(address)) {
      editor?.chain().focus().extendMarkRange("link").unsetLink().run();
      setOpen(false);
      return;
    }
    const target = linkAddress(address);
    if (editor?.can().setLink({ href: target }) !== true) {
      setRefused(true);
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: target })
      .run();
    setOpen(false);
  }

  return (
    <Popover onOpenChange={change} open={open}>
      <ToolHint label={label}>
        <PopoverTrigger
          render={
            <Button
              aria-label={label}
              aria-pressed={active}
              className="aria-pressed:bg-accent aria-pressed:text-accent-foreground"
              size="icon-sm"
              type="button"
              variant="ghost"
            />
          }
        >
          <HugeIcons icon={Link01Icon} />
        </PopoverTrigger>
      </ToolHint>
      <PopoverContent align="start" className="w-72 p-2">
        {/* The field checks no address itself: the editor decides, and says why it refused. */}
        <form
          className="grid gap-2"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            apply();
          }}
        >
          <Input
            aria-invalid={refused}
            aria-label={label}
            autoFocus
            onChange={(event) => {
              setHref(event.target.value);
              setRefused(false);
            }}
            placeholder={placeholder}
            type="url"
            value={href}
          />
          {refused ? (
            <p className="text-destructive text-sm" role="alert">
              {invalid}
            </p>
          ) : null}
        </form>
      </PopoverContent>
    </Popover>
  );
}
