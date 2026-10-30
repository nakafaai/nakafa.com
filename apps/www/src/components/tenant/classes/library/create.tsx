import { QueryResult, useAction, useMutation, useQuery } from "@confect/react";
import { GoogleDriveIcon } from "@hugeicons/core-free-icons";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import connectors from "@repo/backend/confect/_generated/refs/connectors";
import { LIBRARY_BYTE_LIMIT } from "@repo/backend/confect/classroom/library/file";
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
  Tabs,
  TabsList,
  TabsTab,
} from "@repo/design-system/components/ui/tabs";
import { toast } from "@repo/design-system/lib/toast/notify";
import { randomUuid } from "@repo/utilities/uuid";
import { Array as Arr, Effect, Option, Schema, String as Str } from "effect";
import { useId, useState, useTransition } from "react";
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
import type { DriveFile } from "@/components/tenant/classes/library/drive";
import {
  ChosenFile,
  LibraryDriveField,
  LibraryFileField,
} from "@/components/tenant/classes/library/fields";
import { useLibraryUploads } from "@/components/tenant/classes/library/scope";
import { useClassScope } from "@/components/tenant/classes/scope";
import { useViewerQuery } from "@/components/tenant/context";

/** The extension at the end of a file name, which a title leaves out. */
const EXTENSION = /\.[^.]*$/u;

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

/** What the dialog adds: a file from the device, a file from Google Drive, or a link. */
const AddMode = Schema.Literals(["file", "drive", "link"]);

/** The title a file gives an item: its name without the extension, as long as a title may be. */
const titleOf = (name: string) =>
  Str.trim(name.replace(EXTENSION, "")).slice(0, 120);

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
  const offered = useQuery(connectors.google.offered, {});
  const addLink = useMutation(classroom.library.addLink);
  const requestUrl = useMutation(classroom.library.uploadUrl);
  const register = useAction(classroom.library.register);
  const importDrive = useAction(classroom.library.importDrive);
  const pickerToken = useAction(connectors.drive.pickerToken);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<typeof AddMode.Type>("file");
  const [title, setTitle] = useState("");
  const [address, setAddress] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [drive, setDrive] = useState<Option.Option<DriveFile>>(Option.none);
  const [driveMissing, setDriveMissing] = useState(false);
  const [isPicking, startPicking] = useTransition();
  const id = useId();
  const heading = Str.trim(title);
  const link = Str.trim(address);
  const oversize = file !== null && file.size > LIBRARY_BYTE_LIMIT;
  const driveOffered =
    QueryResult.isSuccess(offered) && Arr.contains(offered.value, "drive");
  const ready =
    viewer._tag === "Success" &&
    Schema.is(LibraryTitle)(heading) &&
    {
      drive: Option.isSome(drive),
      file: file !== null && !oversize,
      link: Schema.is(LinkAddress)(link),
    }[mode];

  /** Clears what the dialog holds after its item was sent, so it opens again on a device file. */
  const reset = () => {
    setMode("file");
    setTitle("");
    setAddress("");
    setFile(null);
    setDrive(Option.none());
    setDriveMissing(false);
  };

  /** Names the item after a chosen file when no title was written yet. */
  const nameAfter = (name: string) => {
    if (heading === "") {
      setTitle(titleOf(name));
    }
  };

  /** Takes a chosen file of the device. */
  const choose = (chosen: File | null) => {
    setFile(chosen);
    if (chosen !== null) {
      nameAfter(chosen.name);
    }
  };

  /**
   * Opens Google's Picker with the teacher's Drive. The dialog steps aside while it shows and
   * comes back with the picked file, or as it was when the teacher closed it. An account without
   * Drive is told so in the dialog, with the way to connect it.
   */
  const chooseDrive = () =>
    startPicking(() =>
      runForumCall(
        pickFromDrive(
          () => pickerToken({}),
          locale,
          () => setOpen(false)
        ).pipe(
          Effect.tap((picked) =>
            Effect.sync(() => {
              setDriveMissing(false);
              Option.map(picked, (found) => {
                setDrive(Option.some(found));
                nameAfter(found.name);
              });
              setOpen(true);
            })
          ),
          Effect.catchTag("DriveMissing", () =>
            Effect.sync(() => setDriveMissing(true))
          ),
          Effect.tapError(() => Effect.sync(() => setOpen(true)))
        ),
        toastForumFailure
      )
    );

  /** Shows the link at once, sends it under a new key, and restores the dialog when it fails. */
  const sendLink = (author: string) => {
    runForumCall(
      Effect.flatMap(randomUuid, (clientKey) =>
        addLibraryLink(
          (update, args) => addLink.withOptimisticUpdate(update)(args),
          author,
          { address: link, classId, clientKey, slug, title: heading }
        )
      ),
      () => {
        setTitle((current) => (current === "" ? heading : current));
        setAddress((current) => (current === "" ? link : current));
        setMode("link");
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
              register({ classId, clientKey, slug, storageId, title: heading })
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
    setOpen(false);
    reset();
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
      <Button onClick={() => setOpen(true)}>{t("library-add")}</Button>
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
        open={open}
        setOpen={setOpen}
        title={t("library-add")}
      >
        <FieldGroup>
          <Tabs
            onValueChange={(value) =>
              Option.map(Schema.decodeUnknownOption(AddMode)(value), setMode)
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
            <LibraryFileField file={file} onFile={choose} oversize={oversize} />
          ) : null}
          {mode === "drive" ? (
            <LibraryDriveField
              chosen={Option.isSome(drive)}
              missing={driveMissing}
              onChoose={chooseDrive}
              pending={isPicking}
            >
              {Option.match(drive, {
                onNone: () => null,
                onSome: (picked) => (
                  <ChosenFile
                    icon={GoogleDriveIcon}
                    name={picked.name}
                    onClear={() => setDrive(Option.none())}
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
                onChange={(event) => setAddress(event.target.value)}
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
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t("library-title-placeholder")}
              value={title}
            />
          </Field>
        </FieldGroup>
      </ResponsiveDialog>
    </>
  );
}
