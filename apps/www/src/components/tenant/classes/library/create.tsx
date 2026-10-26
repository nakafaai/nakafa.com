import { useAction, useMutation } from "@confect/react";
import {
  Cancel01Icon,
  FileAttachmentIcon,
  FileUploadIcon,
} from "@hugeicons/core-free-icons";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { LIBRARY_BYTE_LIMIT } from "@repo/backend/confect/classroom/library/file";
import {
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
import { randomUuid } from "@repo/utilities/uuid";
import { Clock, Effect, Option, Schema, String as Str } from "effect";
import { useId, useState } from "react";
import { useTranslations } from "use-intl";
import {
  runForumCall,
  toastForumFailure,
} from "@/components/tenant/classes/forum/call";
import {
  addLibraryLink,
  uploadLibraryFile,
} from "@/components/tenant/classes/library/add";
import { useLibraryUploads } from "@/components/tenant/classes/library/scope";
import { useClassScope } from "@/components/tenant/classes/scope";
import { useViewerQuery } from "@/components/tenant/context";

/** The kinds of file the picker offers, which the server checks again by the file's bytes. */
const LIBRARY_ACCEPT =
  "application/pdf,image/png,image/jpeg,image/webp,image/gif";

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

/** What the dialog adds: a file from the device, or a link. */
const AddMode = Schema.Literals(["file", "link"]);

/**
 * Adds an item to the class library: a PDF or an image from the device, or a link, with its title.
 * The dialog closes on submit and the item shows at once first in the library. A link that fails
 * brings the dialog back with what was written; a file that the server refuses leaves the library
 * and says why.
 */
export function AddToLibrary() {
  const t = useTranslations("Classroom");
  const common = useTranslations("Common");
  const { classId, slug } = useClassScope();
  const viewer = useViewerQuery();
  const uploads = useLibraryUploads();
  const addLink = useMutation(classroom.library.addLink);
  const requestUrl = useMutation(classroom.library.uploadUrl);
  const register = useAction(classroom.library.register);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<typeof AddMode.Type>("file");
  const [title, setTitle] = useState("");
  const [address, setAddress] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const id = useId();
  const heading = Str.trim(title);
  const link = Str.trim(address);
  const oversize = file !== null && file.size > LIBRARY_BYTE_LIMIT;
  const ready =
    viewer._tag === "Success" &&
    Schema.is(LibraryTitle)(heading) &&
    (mode === "file"
      ? file !== null && !oversize
      : Schema.is(LinkAddress)(link));

  /** Clears what the dialog holds, after its item was sent. */
  const reset = () => {
    setTitle("");
    setAddress("");
    setFile(null);
  };

  /** Takes a chosen file, and names the item after it when no title was written yet. */
  const choose = (chosen: File | null) => {
    setFile(chosen);
    if (chosen !== null && heading === "") {
      setTitle(Str.trim(chosen.name.replace(EXTENSION, "")).slice(0, 120));
    }
  };

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
      Effect.gen(function* () {
        const clientKey = yield* randomUuid;
        const createdAt = yield* Clock.currentTimeMillis;
        const store = uploads.getState();
        store.start({
          author,
          clientKey,
          createdAt,
          kind: chosen.type === "application/pdf" ? "pdf" : "image",
          sent: false,
          title: heading,
        });
        yield* uploadLibraryFile(
          chosen,
          () => requestUrl({ classId, slug }),
          (storageId) =>
            register({ classId, clientKey, slug, storageId, title: heading })
        ).pipe(
          Effect.tap(() => Effect.sync(() => store.settle(clientKey))),
          Effect.tapError(() => Effect.sync(() => store.end(clientKey))),
          Effect.catchTags({
            FileSizeRefused: refuseLargeFile,
            FileTypeRefused: refuseOtherFile,
          })
        );
      }),
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
              <TabsTab value="link">{t("library-link")}</TabsTab>
            </TabsList>
          </Tabs>
          {mode === "file" ? (
            <LibraryFileField file={file} onFile={choose} oversize={oversize} />
          ) : (
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
          )}
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
        <div className="flex min-w-0 items-center gap-2 rounded-lg border py-1 pr-1 pl-3 text-sm">
          <HugeIcons aria-hidden="true" icon={FileAttachmentIcon} />
          <span className="min-w-0 flex-1 truncate" dir="auto">
            {file.name}
          </span>
          <Button
            aria-label={t("library-file-clear")}
            onClick={() => onFile(null)}
            size="icon-sm"
            variant="ghost"
          >
            <HugeIcons aria-hidden="true" icon={Cancel01Icon} />
          </Button>
        </div>
      )}
      {oversize ? (
        <FieldError>{t("library-file-oversize")}</FieldError>
      ) : (
        <FieldDescription>{t("library-file-limit")}</FieldDescription>
      )}
    </Field>
  );
}
