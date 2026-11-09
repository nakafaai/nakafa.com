import { useMutation } from "@confect/react";
import { FolderAddIcon, PencilEdit02Icon } from "@hugeicons/core-free-icons";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { FolderName } from "@repo/backend/confect/classroom/library/folder";
import { Button } from "@repo/design-system/components/ui/button";
import { DropdownMenuItem } from "@repo/design-system/components/ui/dropdown-menu";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Input } from "@repo/design-system/components/ui/input";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { randomUuid } from "@repo/utilities/uuid";
import { Clock, Effect, Schema, String as Str } from "effect";
import { type FormEvent, type ReactNode, useId, useState } from "react";
import { useTranslations } from "use-intl";
import { HeaderLabel } from "@/components/shared/breadcrumb/frame";
import { useDialogs } from "@/components/shared/dialogs";
import { RowItems } from "@/components/shared/table/menu";
import {
  addLibraryFolder,
  type LibraryFolder,
  moveFolderUpdate,
  renameFolderUpdate,
  starFolderUpdate,
  trashFolderUpdate,
} from "@/components/tenant/classes/library/folder";
import {
  MoveAndTrash,
  StarItem,
  useStar,
} from "@/components/tenant/classes/library/menu";
import { MoveDialog } from "@/components/tenant/classes/library/move";
import { useLibraryFolder } from "@/components/tenant/classes/library/scope";
import { useClassScope } from "@/components/tenant/classes/scope";
import { useViewerQuery } from "@/components/tenant/context";
import { runSchoolWrite, schoolCall } from "@/components/tenant/write";

/**
 * The dialog that names a folder: a new one, or one the teacher renames. Its action waits for a name that holds and
 * that differs from the one it opened with, and Enter sends it as the action does.
 */
function FolderNameDialog({
  action,
  description,
  named,
  onName,
  open,
  setOpen,
  title,
}: {
  action: string;
  description: string;
  /** The name the dialog opens with, empty for a new folder. */
  named: string;
  onName: (name: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  title: string;
}) {
  const t = useTranslations("Classroom");
  const id = useId();
  const [edited, setEdited] = useState<string | null>(null);
  const name = edited ?? named;
  const next = Str.trim(name);
  const canSave = Schema.is(FolderName)(next) && next !== named;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (canSave) {
      onName(next);
    }
  };

  return (
    <ResponsiveDialog
      action={
        <Button disabled={!canSave} form={id} type="submit">
          {action}
        </Button>
      }
      description={description}
      open={open}
      setOpen={setOpen}
      title={title}
    >
      <form id={id} onSubmit={submit}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`${id}-name`}>
              {t("library-folder-name")}
            </FieldLabel>
            <Input
              dir="auto"
              id={`${id}-name`}
              onChange={(event) => setEdited(event.target.value)}
              placeholder={t("library-folder-placeholder")}
              value={name}
            />
          </Field>
        </FieldGroup>
      </form>
    </ResponsiveDialog>
  );
}

/**
 * Adds a folder inside the folder the page shows, or at the top of the library. The dialog closes on submit and the
 * folder shows at once last among the folders, and a refusal brings the dialog back. On a narrow screen the button
 * keeps its icon. It stands in the header's group beside the search, which gives it its variant.
 */
export function NewFolder() {
  const t = useTranslations("Classroom");
  const { classId, slug } = useClassScope();
  const parentId = useLibraryFolder();
  const viewer = useViewerQuery();
  const add = useMutation(classroom.folders.add);
  const [open, setOpen] = useState(false);
  const [opened, setOpened] = useState(0);

  const create = (name: string) => {
    if (viewer._tag !== "Success") {
      return;
    }
    const author = viewer.value.person.name;
    setOpen(false);
    runSchoolWrite(
      Effect.flatMap(randomUuid, (clientKey) =>
        addLibraryFolder(
          (update, args) => add.withOptimisticUpdate(update)(args),
          author,
          { classId, clientKey, name, parentId, slug }
        )
      ),
      {
        onFailed: () => {
          setOpen(true);
        },
      }
    );
  };

  return (
    <>
      {/* A narrow header shows the icon alone, so its name stays in the tooltip. */}
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              className="@xs/header:has-[>svg]:px-4"
              onClick={() => {
                setOpened((count) => count + 1);
                setOpen(true);
              }}
              type="button"
            />
          }
        >
          <HugeIcons
            aria-hidden="true"
            className="@2xl/header:hidden"
            icon={FolderAddIcon}
          />
          <HeaderLabel>{t("library-new-folder")}</HeaderLabel>
        </TooltipTrigger>
        <TooltipContent side="bottom">{t("library-new-folder")}</TooltipContent>
      </Tooltip>
      {opened === 0 ? null : (
        <FolderNameDialog
          action={t("library-folder-create")}
          description={t("library-new-folder-description")}
          key={opened}
          named=""
          onName={create}
          open={open}
          setOpen={setOpen}
          title={t("library-new-folder")}
        />
      )}
    </>
  );
}

/**
 * The menu of a saved folder for whoever manages the library: what every row can do (`children`), Star, Rename and
 * Move, which open their dialogs, and Move to trash, which hides the folder and everything inside it at once.
 */
export function FolderRowMenu({
  children,
  folder,
}: {
  children: ReactNode;
  folder: LibraryFolder;
}) {
  const t = useTranslations("Classroom");
  const { classId, slug } = useClassScope();
  const rename = useMutation(classroom.folders.rename);
  const move = useMutation(classroom.folders.move);
  const trash = useMutation(classroom.folders.trash);
  const star = useStar();
  const dialogs = useDialogs<"rename" | "move">();

  return (
    <>
      <RowItems>
        {children}
        <StarItem
          onStar={() =>
            star(
              { folderId: folder.id, kind: "folder" },
              !folder.starred,
              starFolderUpdate
            )
          }
          starred={folder.starred}
        />
        <DropdownMenuItem
          icon={PencilEdit02Icon}
          onClick={() => dialogs.show("rename")}
        >
          {t("library-folder-rename")}
        </DropdownMenuItem>
        <MoveAndTrash
          onMove={() => dialogs.show("move")}
          onTrash={() =>
            runSchoolWrite(
              schoolCall(() =>
                trash.withOptimisticUpdate(
                  trashFolderUpdate(Effect.runSync(Clock.currentTimeMillis))
                )({
                  classId,
                  folderId: folder.id,
                  slug,
                })
              )
            )
          }
        />
      </RowItems>
      {dialogs.kind === "rename" ? (
        <FolderNameDialog
          action={t("library-folder-rename")}
          description={t("library-folder-rename-description")}
          key={dialogs.key}
          named={folder.name}
          onName={(name) => {
            dialogs.close();
            runSchoolWrite(
              schoolCall(() =>
                rename.withOptimisticUpdate(renameFolderUpdate)({
                  classId,
                  folderId: folder.id,
                  name,
                  slug,
                })
              )
            );
          }}
          open={dialogs.isOpen("rename")}
          setOpen={dialogs.setOpen}
          title={t("library-folder-rename")}
        />
      ) : null}
      {dialogs.kind === "move" ? (
        <MoveDialog
          current={folder.parentId}
          key={dialogs.key}
          moving={folder.id}
          onMove={(parentId) => {
            dialogs.close();
            runSchoolWrite(
              schoolCall(() =>
                move.withOptimisticUpdate(moveFolderUpdate)({
                  classId,
                  folderId: folder.id,
                  parentId,
                  slug,
                })
              )
            );
          }}
          open={dialogs.isOpen("move")}
          setOpen={dialogs.setOpen}
        />
      ) : null}
    </>
  );
}
