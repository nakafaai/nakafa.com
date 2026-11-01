import { QueryResult, useAction, useMutation, useQuery } from "@confect/react";
import { GoogleDriveIcon } from "@hugeicons/core-free-icons";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import connectors from "@repo/backend/confect/_generated/refs/connectors";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import {
  Tabs,
  TabsList,
  TabsTab,
} from "@repo/design-system/components/ui/tabs";
import { toast } from "@repo/design-system/lib/toast/notify";
import { randomUuid } from "@repo/utilities/uuid";
import { Array as Arr, Effect, Option, Schema, String as Str } from "effect";
import { useId, useReducer, useRef, useState } from "react";
import { useLocale, useTranslations } from "use-intl";
import {
  forumCall,
  runForumCall,
  toastForumFailure,
} from "@/components/tenant/classes/forum/call";
import {
  addLibraryLink,
  pickFromDrive,
  sendLibraryFile,
  uploadLibraryFile,
} from "@/components/tenant/classes/library/add";
import {
  AddMode,
  type DriveFile,
  EMPTY_DRAFT,
  isDraftReady,
  isOversize,
  stepDraft,
} from "@/components/tenant/classes/library/draft";
import {
  ChosenFile,
  LibraryDriveField,
  LibraryFileField,
} from "@/components/tenant/classes/library/fields";
import {
  useLibraryFolder,
  useLibraryUploads,
} from "@/components/tenant/classes/library/scope";
import { useClassScope } from "@/components/tenant/classes/scope";
import { useViewerQuery } from "@/components/tenant/context";
import { SchoolHeaderAdd } from "@/components/tenant/header";

/** Tells the teacher that a file larger than the library keeps was not added. */
const refuseLargeFile = () =>
  Effect.sync(() =>
    toast.error({
      description: "library-file-size.description",
      title: "library-file-size.title",
    })
  );

/** Tells the teacher that a file whose bytes name no PDF or image was not added. */
const refuseOtherFile = () =>
  Effect.sync(() =>
    toast.error({
      description: "library-file-type.description",
      title: "library-file-type.title",
    })
  );

/** The library row's kind for a file's type. */
const kindOf = (type: string) =>
  type === "application/pdf" ? ("pdf" as const) : ("image" as const);

/**
 * Adds an item to the class library: a PDF or an image from the device or from the teacher's
 * Google Drive, or a link, with its title. The dialog closes on submit and the item shows at once
 * first in the library. A link that fails brings the dialog back with what was written; a file
 * that the server refuses leaves the library and says why. The Drive tab shows only where the
 * deployment offers Drive; Google's Picker opens over the page while the dialog steps aside.
 */
export function AddToLibrary() {
  const t = useTranslations("Classroom");
  const common = useTranslations("Common");
  const locale = useLocale();
  const { classId, slug } = useClassScope();
  const viewer = useViewerQuery();
  const uploads = useLibraryUploads();
  const folderId = useLibraryFolder();
  const offered = useQuery(connectors.google.offered, {});
  const addLink = useMutation(classroom.library.addLink);
  const requestUrl = useMutation(classroom.library.uploadUrl);
  const register = useAction(classroom.library.register);
  const importDrive = useAction(classroom.library.importDrive);
  const pickerToken = useAction(connectors.drive.pickerToken);
  const [open, setOpen] = useState(false);
  const [draft, change] = useReducer(stepDraft, EMPTY_DRAFT);
  // Whether the dialog closes because its item was sent; Drive's picker closes it too, and keeps it as it was.
  const sent = useRef(false);
  const id = useId();
  const { address, drive, driveStep, file, mode, title } = draft;
  const heading = Str.trim(title);
  const link = Str.trim(address);
  const oversize = isOversize(file);
  const driveOffered =
    QueryResult.isSuccess(offered) && Arr.contains(offered.value, "drive");
  const ready = viewer._tag === "Success" && isDraftReady(draft);

  /**
   * Opens Google's Picker with the teacher's Drive. It runs outside any transition, because a teacher can browse Drive
   * for as long as they like and a transition would hold every navigation until they finish (ADR 0017). The dialog
   * shows the wait until the Picker can show, steps aside while it shows, and comes back with the picked file, or as it
   * was when the teacher closed it. An account without Drive is told so in the dialog, with the way to connect it.
   */
  const chooseDrive = () => {
    change({ _tag: "picking" });
    runForumCall(
      pickFromDrive(
        () => pickerToken({}),
        locale,
        () => setOpen(false)
      ).pipe(
        Effect.tap((picked) =>
          Effect.sync(() => {
            change({ _tag: "picked", picked });
            setOpen(true);
          })
        ),
        Effect.catchTag("DriveMissing", () =>
          Effect.sync(() => change({ _tag: "missing" }))
        )
      ),
      () => {
        change({ _tag: "picked", picked: Option.none() });
        toastForumFailure();
      }
    );
  };

  /** Shows the link at once, sends it under a new key, and restores the dialog when it fails. */
  const sendLink = (author: string) => {
    runForumCall(
      Effect.flatMap(randomUuid, (clientKey) =>
        addLibraryLink(
          (update, args) => addLink.withOptimisticUpdate(update)(args),
          author,
          { address: link, classId, clientKey, folderId, slug, title: heading }
        )
      ),
      () => {
        change({ _tag: "restored", address: link, title: heading });
        setOpen(true);
        toastForumFailure();
      }
    );
  };

  /** Shows the file at once, sends and registers it, and takes its row away when the server refuses it. */
  const sendFile = (author: string, chosen: File) => {
    runForumCall(
      sendLibraryFile(
        uploads.getState(),
        { author, kind: kindOf(chosen.type), title: heading },
        (clientKey) =>
          uploadLibraryFile(
            chosen,
            () => requestUrl({ classId, slug }),
            (storageId) =>
              register({
                classId,
                clientKey,
                folderId,
                slug,
                storageId,
                title: heading,
              })
          )
      ).pipe(
        Effect.catchTags({
          FileSizeRefused: refuseLargeFile,
          FileTypeRefused: refuseOtherFile,
        })
      ),
      toastForumFailure
    );
  };

  /** Shows the Drive file at once, has the server import it, and takes its row away when the server refuses it. */
  const sendDrive = (author: string, picked: DriveFile) => {
    runForumCall(
      sendLibraryFile(
        uploads.getState(),
        { author, kind: kindOf(picked.mimeType), title: heading },
        (clientKey) =>
          forumCall(() =>
            importDrive({
              classId,
              clientKey,
              fileId: picked.id,
              folderId,
              slug,
              title: heading,
            })
          )
      ).pipe(
        Effect.catchTags({
          FileSizeRefused: refuseLargeFile,
          FileTypeRefused: refuseOtherFile,
        })
      ),
      toastForumFailure
    );
  };

  const submit = () => {
    if (!ready || viewer._tag !== "Success") {
      return;
    }
    const author = viewer.value.person.name;
    sent.current = true;
    setOpen(false);
    if (mode === "link") {
      sendLink(author);
      return;
    }
    if (mode === "drive") {
      Option.map(drive, (picked) => sendDrive(author, picked));
      return;
    }
    if (file !== null) {
      sendFile(author, file);
    }
  };

  return (
    <>
      <SchoolHeaderAdd label={t("library-add")} onClick={() => setOpen(true)} />
      <ResponsiveDialog
        description={t("library-add-description")}
        footer={
          <>
            <Button onClick={() => setOpen(false)} variant="outline">
              {common("cancel")}
            </Button>
            <Button disabled={!ready} onClick={submit}>
              {t("library-submit")}
            </Button>
          </>
        }
        // A sent item's dialog empties once it has closed, so it keeps what was sent while it closes.
        onOpenChangeComplete={(next) => {
          if (!next && sent.current) {
            change({ _tag: "reset" });
          }
          sent.current = false;
        }}
        open={open}
        setOpen={setOpen}
        title={t("library-add")}
      >
        <FieldGroup>
          <Tabs
            onValueChange={(value) =>
              Option.map(Schema.decodeUnknownOption(AddMode)(value), (next) =>
                change({ _tag: "mode", mode: next })
              )
            }
            value={mode}
          >
            <TabsList className="w-full">
              <TabsTab value="file">{t("library-file")}</TabsTab>
              {driveOffered ? (
                <TabsTab value="drive">{t("library-drive")}</TabsTab>
              ) : null}
              <TabsTab value="link">{t("library-link")}</TabsTab>
            </TabsList>
          </Tabs>
          {mode === "file" ? (
            <LibraryFileField
              file={file}
              onFile={(chosen) => change({ _tag: "file", file: chosen })}
              oversize={oversize}
            />
          ) : null}
          {mode === "drive" ? (
            <LibraryDriveField
              chosen={Option.isSome(drive)}
              missing={driveStep === "missing"}
              onChoose={chooseDrive}
              pending={driveStep === "picking"}
            >
              {Option.match(drive, {
                onNone: () => null,
                onSome: (picked) => (
                  <ChosenFile
                    icon={GoogleDriveIcon}
                    name={picked.name}
                    onClear={() => change({ _tag: "cleared" })}
                  />
                ),
              })}
            </LibraryDriveField>
          ) : null}
          {mode === "link" ? (
            <Field>
              <FieldLabel htmlFor={`${id}-address`}>
                {t("library-address")}
              </FieldLabel>
              <Input
                autoComplete="url"
                id={`${id}-address`}
                inputMode="url"
                onChange={(event) =>
                  change({ _tag: "address", text: event.target.value })
                }
                placeholder="https://"
                type="url"
                value={address}
              />
            </Field>
          ) : null}
          <Field>
            <FieldLabel htmlFor={`${id}-title`}>
              {t("library-title")}
            </FieldLabel>
            <Input
              dir="auto"
              id={`${id}-title`}
              maxLength={120}
              onChange={(event) =>
                change({ _tag: "title", text: event.target.value })
              }
              placeholder={t("library-title-placeholder")}
              value={title}
            />
          </Field>
        </FieldGroup>
      </ResponsiveDialog>
    </>
  );
}
