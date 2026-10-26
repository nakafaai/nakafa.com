import { QueryResult, useAction, useMutation, useQuery } from "@confect/react";
import {
  Cancel01Icon,
  FileAttachmentIcon,
  FileUploadIcon,
  GoogleDriveIcon,
} from "@hugeicons/core-free-icons";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import connectors from "@repo/backend/confect/_generated/refs/connectors";
import { LIBRARY_BYTE_LIMIT } from "@repo/backend/confect/classroom/library/file";
import {
  LIBRARY_ACCEPT,
  LibraryTitle,
  LinkAddress,
} from "@repo/backend/confect/classroom/library/item";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@repo/design-system/components/ui/field";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Input } from "@repo/design-system/components/ui/input";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import {
  Tabs,
  TabsList,
  TabsTab,
} from "@repo/design-system/components/ui/tabs";
import { toast } from "@repo/design-system/lib/toast/notify";
import { SITE_ORIGIN } from "@repo/seo/origin";
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
              file={drive}
              missing={driveMissing}
              onChoose={chooseDrive}
              onClear={() => setDrive(Option.none())}
              pending={isPicking}
            />
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
              value={title}
            />
          </Field>
        </FieldGroup>
      </ResponsiveDialog>
    </>
  );
}

/** The file of a new item: a drop area until a file is chosen, then the file's name with a way to clear it. */
function LibraryFileField({
  file,
  onFile,
  oversize,
}: {
  file: File | null;
  onFile: (file: File | null) => void;
  oversize: boolean;
}) {
  const t = useTranslations("Classroom");
  const id = useId();
  const [dragging, setDragging] = useState(false);

  return (
    <Field data-invalid={oversize}>
      <FieldLabel htmlFor={id}>{t("library-file")}</FieldLabel>
      {file === null ? (
        <div
          className="relative flex flex-col items-center gap-2 rounded-lg border bg-muted/40 px-4 py-6 text-center text-muted-foreground text-sm transition-colors hover:bg-muted has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/50 data-[dragging=true]:border-primary data-[dragging=true]:bg-muted"
          data-dragging={dragging}
        >
          <HugeIcons aria-hidden="true" icon={FileUploadIcon} />
          <span>{t("library-drop")}</span>
          <input
            accept={LIBRARY_ACCEPT}
            aria-label={t("library-file")}
            className="absolute inset-0 cursor-pointer opacity-0"
            id={id}
            onChange={(event) => onFile(event.target.files?.item(0) ?? null)}
            onDragEnter={() => setDragging(true)}
            onDragLeave={() => setDragging(false)}
            onDrop={() => setDragging(false)}
            type="file"
          />
        </div>
      ) : (
        <ChosenFile
          icon={FileAttachmentIcon}
          name={file.name}
          onClear={() => onFile(null)}
        />
      )}
      {oversize ? (
        <FieldError>{t("library-file-oversize")}</FieldError>
      ) : (
        <FieldDescription>{t("library-file-limit")}</FieldDescription>
      )}
    </Field>
  );
}

/** A chosen file of a new item: its icon and name, with a way to clear it. */
function ChosenFile({
  icon,
  name,
  onClear,
}: {
  icon: typeof FileAttachmentIcon;
  name: string;
  onClear: () => void;
}) {
  const t = useTranslations("Classroom");

  return (
    <div className="flex min-w-0 items-center gap-2 rounded-lg border py-1 pr-1 pl-3 text-sm">
      <HugeIcons aria-hidden="true" icon={icon} />
      <span className="min-w-0 flex-1 truncate" dir="auto">
        {name}
      </span>
      <Button
        aria-label={t("library-file-clear")}
        onClick={onClear}
        size="icon-sm"
        variant="ghost"
      >
        <HugeIcons aria-hidden="true" icon={Cancel01Icon} />
      </Button>
    </div>
  );
}

/**
 * The Drive file of a new item: a button that opens Google's Picker until a file is picked, then
 * the file's name with a way to clear it. An account without Drive is told so, with a link to its
 * connections, which opens beside the class so the dialog keeps what was written.
 */
function LibraryDriveField({
  file,
  missing,
  onChoose,
  onClear,
  pending,
}: {
  file: Option.Option<DriveFile>;
  missing: boolean;
  onChoose: () => void;
  onClear: () => void;
  pending: boolean;
}) {
  const t = useTranslations("Classroom");
  const locale = useLocale();

  return (
    <Field>
      {/* The button's own words name it, so the field's title is not its label. */}
      <FieldTitle>{t("library-drive")}</FieldTitle>
      {Option.isNone(file) ? (
        <Button disabled={pending} onClick={onChoose} variant="outline">
          <HugeIcons aria-hidden="true" icon={GoogleDriveIcon} />
          {t("library-drive-choose")}
        </Button>
      ) : (
        <ChosenFile
          icon={GoogleDriveIcon}
          name={file.value.name}
          onClear={onClear}
        />
      )}
      {missing ? (
        <FieldDescription>
          {t("library-drive-missing")}{" "}
          <a
            className="font-medium text-foreground underline underline-offset-4"
            href={
              new URL(`/${locale}/user/settings/connectors`, SITE_ORIGIN).href
            }
            rel="noopener"
            target="_blank"
          >
            {t("library-drive-connect")}
          </a>
        </FieldDescription>
      ) : (
        <FieldDescription>{t("library-file-limit")}</FieldDescription>
      )}
    </Field>
  );
}
