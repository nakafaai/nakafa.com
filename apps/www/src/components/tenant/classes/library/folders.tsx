import { QueryResult, useMutation, useQuery } from "@confect/react";
import {
  Delete02Icon,
  FolderAddIcon,
  PencilEdit02Icon,
} from "@hugeicons/core-free-icons";
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
import { randomUuid } from "@repo/utilities/uuid";
import { Effect, Schema, String as Str } from "effect";
import { type FormEvent, useId, useState } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { useDialogs } from "@/components/shared/dialogs";
import { ConfirmRowMenu } from "@/components/shared/table/confirm";
import {
  forumCall,
  runForumCall,
  toastForumFailure,
} from "@/components/tenant/classes/forum/call";
import {
  addLibraryFolder,
  type LibraryFolder,
  removeFolderUpdate,
  renameFolderUpdate,
} from "@/components/tenant/classes/library/folder";
import { useClassScope } from "@/components/tenant/classes/scope";
import { useViewerQuery } from "@/components/tenant/context";

/** The folders of the class around the caller, oldest first, none while they load. */
export function useFolderList() {
  const { classId, slug } = useClassScope();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const folders = useQuery(
    classroom.folders.list,
    isSettled ? { classId, slug } : "skip"
  );

  if (QueryResult.isFailure(folders)) {
    throw folders.error;
  }
  return QueryResult.isSuccess(folders) ? folders.value : [];
}

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
  const common = useTranslations("Common");
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
          <Button disabled={!canSave} form={id} type="submit">
            {action}
          </Button>
        </>
      }
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
 * Adds a folder to the class library. The dialog closes on submit and the folder shows at once last among the folders,
 * and a refusal brings the dialog back. On a narrow screen the button keeps its icon.
 */
export function NewFolder() {
  const t = useTranslations("Classroom");
  const { classId, slug } = useClassScope();
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
    runForumCall(
      Effect.flatMap(randomUuid, (clientKey) =>
        addLibraryFolder(
          (update, args) => add.withOptimisticUpdate(update)(args),
          author,
          { classId, clientKey, name, slug }
        )
      ),
      () => {
        setOpen(true);
        toastForumFailure();
      }
    );
  };

  return (
    <>
      <Button
        className="@xs/header:has-[>svg]:px-4"
        onClick={() => {
          setOpened((count) => count + 1);
          setOpen(true);
        }}
        type="button"
        variant="outline"
      >
        <HugeIcons
          aria-hidden="true"
          className="@xs/header:hidden"
          icon={FolderAddIcon}
        />
        <span className="@max-xs/header:sr-only">
          {t("library-new-folder")}
        </span>
      </Button>
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
 * The menu of a saved folder for a teacher: Rename, which opens its dialog, and Delete, which asks first, takes the
 * row away at once, and leaves the folder's files in the library.
 */
export function FolderRowMenu({ folder }: { folder: LibraryFolder }) {
  const t = useTranslations("Classroom");
  const { classId, slug } = useClassScope();
  const rename = useMutation(classroom.folders.rename);
  const remove = useMutation(classroom.folders.remove);
  const dialogs = useDialogs<"rename">();

  return (
    <>
      <ConfirmRowMenu
        action={t("library-folder-remove")}
        confirm={t("library-folder-remove")}
        description={t("library-folder-remove-description")}
        icon={Delete02Icon}
        onConfirm={() =>
          runForumCall(
            forumCall(() =>
              remove.withOptimisticUpdate(removeFolderUpdate)({
                classId,
                folderId: folder.id,
                slug,
              })
            ),
            toastForumFailure
          )
        }
        title={t("library-folder-remove-title")}
      >
        <DropdownMenuItem onClick={() => dialogs.show("rename")}>
          <HugeIcons icon={PencilEdit02Icon} />
          {t("library-folder-rename")}
        </DropdownMenuItem>
      </ConfirmRowMenu>
      {dialogs.kind === "rename" ? (
        <FolderNameDialog
          action={t("library-folder-rename")}
          description={t("library-folder-rename-description")}
          key={dialogs.key}
          named={folder.name}
          onName={(name) => {
            dialogs.close();
            runForumCall(
              forumCall(() =>
                rename.withOptimisticUpdate(renameFolderUpdate)({
                  classId,
                  folderId: folder.id,
                  name,
                  slug,
                })
              ),
              toastForumFailure
            );
          }}
          open={dialogs.isOpen("rename")}
          setOpen={dialogs.setOpen}
          title={t("library-folder-rename")}
        />
      ) : null}
    </>
  );
}
