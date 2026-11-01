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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { Array as Arr, Option, Schema } from "effect";
import { startTransition, useId, useState } from "react";
import { useTranslations } from "use-intl";
import { useFolderList } from "@/components/tenant/classes/library/folders";
import {
  editItemUpdate,
  type LibraryItem,
} from "@/components/tenant/classes/library/optimistic";
import { useClassScope } from "@/components/tenant/classes/scope";
import { saveSchool } from "@/components/tenant/settings/save";

const SOURCE = "components/tenant/classes/library/edit";

/** The choice that takes an item out of its folder, to the top of the library. */
const NO_FOLDER = "none";

/**
 * The dialog that changes a library item from its row: its title, its folder, and a link's address.
 * The row shows the change at once and a refusal takes it back. Save waits for a change that holds, and
 * a file, whose address the server draws for each reader, has no address to change. A library with no
 * folder asks for none.
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
  const [editedTitle, setTitle] = useState<string | null>(null);
  const [editedAddress, setAddress] = useState<string | null>(null);
  const title = editedTitle ?? item.title;
  const address = editedAddress ?? item.address ?? "";
  const folders = useFolderList();
  const [chosen, setChosen] = useState<string | null>(null);
  const folder = chosen ?? item.folderId ?? NO_FOLDER;
  const nextFolder = Option.getOrNull(
    Option.map(
      Arr.findFirst(folders, (found) => found.id === folder),
      (found) => found.id
    )
  );
  const folderItems = [
    { label: t("library-no-folder"), value: NO_FOLDER },
    ...Arr.map(folders, (found) => ({ label: found.name, value: found.id })),
  ];
  const nextTitle = title.trim();
  const nextAddress = address.trim();
  const canSave =
    Schema.is(LibraryTitle)(nextTitle) &&
    (nextTitle !== item.title ||
      nextFolder !== item.folderId ||
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
            folderId: nextFolder,
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
      title={t("library-edit-title")}
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
        {Arr.isReadonlyArrayEmpty(folders) ? null : (
          <Field>
            <FieldLabel htmlFor={`${id}-folder`}>
              {t("library-folder")}
            </FieldLabel>
            <Select
              items={folderItems}
              onValueChange={setChosen}
              value={folder}
            >
              <SelectTrigger className="w-full" id={`${id}-folder`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Arr.map(folderItems, (choice) => (
                  <SelectItem key={choice.value} value={choice.value}>
                    {choice.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
      </FieldGroup>
    </ResponsiveDialog>
  );
}
