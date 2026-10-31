import { useMutation } from "@confect/react";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import {
  LibraryTitle,
  LinkAddress,
} from "@repo/backend/confect/classroom/library/item";
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
import {
  editItemUpdate,
  type LibraryItem,
} from "@/components/tenant/classes/library/optimistic";
import { useClassScope } from "@/components/tenant/classes/scope";
import { saveSchool } from "@/components/tenant/settings/save";

const SOURCE = "components/tenant/classes/library/edit";

/**
 * The dialog that changes a library item from its row: its title, and a link's address. The row
 * shows the change at once and a refusal takes it back. Save waits for a change that holds, and a
 * file, whose address the server draws for each reader, has no address to change.
 */
export function LibraryEditDialog({
  item,
  open,
  setOpen,
}: {
  item: LibraryItem;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const t = useTranslations("Classroom");
  const common = useTranslations("Common");
  const settings = useTranslations("SchoolSettings");
  const { classId, slug } = useClassScope();
  const id = useId();
  const edit = useMutation(classroom.library.edit).withOptimisticUpdate(
    editItemUpdate
  );
  const isLink = item.kind === "link";
  const [title, setTitle] = useState(item.title);
  const [address, setAddress] = useState(item.address ?? "");
  const nextTitle = title.trim();
  const nextAddress = address.trim();
  const canSave =
    Schema.is(LibraryTitle)(nextTitle) &&
    (nextTitle !== item.title ||
      (isLink && nextAddress !== item.address)) &&
    (!isLink || Schema.is(LinkAddress)(nextAddress));

  const save = () => {
    if (!canSave) {
      return;
    }
    setOpen(false);
    startTransition(() =>
      saveSchool(
        () =>
          edit({
            address: isLink ? nextAddress : null,
            classId,
            itemId: item.id,
            slug,
            title: nextTitle,
          }),
        SOURCE
      )
    );
  };

  return (
    <ResponsiveDialog
      description={t("library-edit-description")}
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
            {settings("save")}
          </Button>
        </>
      }
      open={open}
      setOpen={setOpen}
      title={t("library-edit")}
    >
      <FieldGroup>
        {isLink ? (
          <Field>
            <FieldLabel htmlFor={`${id}-address`}>
              {t("library-address")}
            </FieldLabel>
            <Input
              autoComplete="url"
              id={`${id}-address`}
              inputMode="url"
              onChange={(event) => setAddress(event.target.value)}
              placeholder="https://"
              type="url"
              value={address}
            />
          </Field>
        ) : null}
        <Field>
          <FieldLabel htmlFor={`${id}-title`}>{t("library-title")}</FieldLabel>
          <Input
            dir="auto"
            id={`${id}-title`}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t("library-title-placeholder")}
            value={title}
          />
        </Field>
      </FieldGroup>
    </ResponsiveDialog>
  );
}
