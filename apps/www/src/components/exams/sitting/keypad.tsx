import { KeyboardIcon } from "@hugeicons/core-free-icons";
import { ArabicKeypad } from "@repo/design-system/components/ui/arabic";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { InputGroupButton } from "@repo/design-system/components/ui/input-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import { typeIntoField } from "@repo/design-system/lib/arabic/type";
import { type RefObject, useState } from "react";
import { useTranslations } from "use-intl";
import { usePaperLocked } from "@/components/exams/sitting/lock";

/**
 * The control beside a short answer's or an essay's field that opens the Arabic keypad, so a student
 * without an Arabic keyboard writes an Arabic answer with its harakat, as a teacher does in the editor. A
 * key types at the field's caret through `typeIntoField`, which the field reads as the student's typing,
 * and the field keeps its focus. The keypad stays open while the student moves the caret in the field, and
 * closes from its control, Escape, or a press elsewhere.
 */
export function SittingKeypad({
  field,
}: {
  readonly field: RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
}) {
  const t = useTranslations("Editor");
  const disabled = usePaperLocked();
  const [open, setOpen] = useState(false);

  return (
    <Popover
      onOpenChange={(next, details) => {
        const inField =
          details.reason === "outside-press" &&
          details.event.target instanceof Node &&
          field.current?.contains(details.event.target) === true;
        if (!inField) {
          setOpen(next);
        }
      }}
      open={open}
    >
      <PopoverTrigger
        render={
          <InputGroupButton
            aria-label={t("arabic")}
            aria-pressed={open}
            className="aria-pressed:bg-accent aria-pressed:text-accent-foreground"
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
            size="icon-xs"
          />
        }
      >
        <HugeIcons icon={KeyboardIcon} />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-auto max-w-(--available-width) p-2"
        finalFocus={false}
        initialFocus={false}
      >
        <ArabicKeypad
          onKey={(text) => {
            if (field.current !== null) {
              typeIntoField(field.current, text);
            }
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
