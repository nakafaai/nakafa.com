import { useMutation } from "@confect/react";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { PersonName } from "@repo/backend/confect/tenancy/schema";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Schema } from "effect";
import { startTransition, useId, useState } from "react";
import { useTranslations } from "use-intl";
import { useTenant } from "@/components/tenant/context";
import { renamePersonChange } from "@/components/tenant/settings/accounts";
import { saveSchool } from "@/components/tenant/settings/save";
import type { Member } from "@/components/tenant/settings/state";

const SOURCE = "components/tenant/settings/rename";

/**
 * The dialog that renames a person of the school, from a members or a logins row: the name field starts from the
 * person's name, and Save waits for a new name that is one line. Save closes the dialog at once, the rows show the
 * name at once, and a refused rename goes back. Each opening is a dialog of its own, so its field starts fresh.
 */
export function PersonRenameDialog({
  open,
  person,
  setOpen,
}: {
  open: boolean;
  person: Pick<Member, "id" | "name">;
  setOpen: (open: boolean) => void;
}) {
  const t = useTranslations("SchoolSettings");
  const common = useTranslations("Common");
  const { slug } = useTenant();
  const id = useId();
  const rename = useMutation(tenancy.people.rename).withOptimisticUpdate(
    renamePersonChange
  );
  // The field holds what the admin typed, and the person's own name until they type.
  const [typed, setName] = useState<string | null>(null);
  const name = typed ?? person.name;
  const next = name.trim();
  const canSave = next !== person.name && Schema.is(PersonName)(next);

  const save = () => {
    if (!canSave) {
      return;
    }
    setOpen(false);
    startTransition(() =>
      saveSchool(
        () => rename({ name: next, personId: person.id, slug }),
        SOURCE
      )
    );
  };

  return (
    <ResponsiveDialog
      description={t("person-rename-description")}
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
            {t("person-rename-save")}
          </Button>
        </>
      }
      open={open}
      setOpen={setOpen}
      title={person.name}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`${id}-name`}>{t("member-name")}</FieldLabel>
          <Input
            dir="auto"
            id={`${id}-name`}
            maxLength={120}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("invite-name-placeholder")}
            value={name}
          />
        </Field>
      </FieldGroup>
    </ResponsiveDialog>
  );
}
