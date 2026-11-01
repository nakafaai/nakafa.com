import { Button } from "@repo/design-system/components/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { type ComponentProps, useId, useState } from "react";
import { useTranslations } from "use-intl";

/**
 * The dialog that changes one line of a record: its field starts from the stored value, and Save
 * waits for a new value that holds. Save closes the dialog at once and hands the value over, so the
 * row shows it at once. The caller mounts the dialog fresh for each opening, or the field keeps
 * what was typed while it is closed. `action` names the button when the line does more than save.
 */
export function LineDialog({
  action,
  description,
  initial,
  isValid,
  label,
  onSave,
  open,
  placeholder,
  setOpen,
  title,
  type = "text",
}: {
  action?: string;
  description: string;
  initial: string;
  isValid: (value: string) => boolean;
  label: string;
  onSave: (value: string) => void;
  open: boolean;
  placeholder: string;
  setOpen: (open: boolean) => void;
  title: string;
  type?: ComponentProps<typeof Input>["type"];
}) {
  const common = useTranslations("Common");
  const settings = useTranslations("SchoolSettings");
  const id = useId();
  // The field holds what was typed, and the stored value until then.
  const [typed, setTyped] = useState<string | null>(null);
  const next = (typed ?? initial).trim();
  const canSave = next !== initial && isValid(next);

  const save = () => {
    if (!canSave) {
      return;
    }
    setOpen(false);
    setTyped(null);
    onSave(next);
  };

  return (
    <ResponsiveDialog
      description={description}
      footer={
        <>
          <Button
            onClick={() => setOpen(false)}
            type="button"
            variant="outline"
          >
            {common("cancel")}
          </Button>
          <Button disabled={!canSave} onClick={save} type="button">
            {action ?? settings("save")}
          </Button>
        </>
      }
      open={open}
      setOpen={setOpen}
      title={title}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`${id}-value`}>{label}</FieldLabel>
          <Input
            dir="auto"
            id={`${id}-value`}
            onChange={(event) => setTyped(event.target.value)}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) {
                return;
              }
              if (event.key === "Enter") {
                save();
              }
            }}
            placeholder={placeholder}
            type={type}
            value={typed ?? initial}
          />
        </Field>
      </FieldGroup>
    </ResponsiveDialog>
  );
}
