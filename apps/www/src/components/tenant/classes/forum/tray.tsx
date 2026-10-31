import { useAction, useMutation } from "@confect/react";
import { Cancel01Icon, File02Icon } from "@hugeicons/core-free-icons";
import { Id } from "@repo/backend/confect/_generated/id";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import {
  ATTACHMENT_LIMIT,
  AttachmentKind,
} from "@repo/backend/confect/classroom/forum/attachment";
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
} from "@repo/design-system/components/ui/attachment";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { toast } from "@repo/design-system/lib/toast/notify";
import { randomUuid } from "@repo/utilities/uuid";
import {
  Array as Arr,
  Effect,
  Function as Fn,
  Option,
  Schema,
  String as Str,
} from "effect";
import { useState } from "react";
import { useTranslations } from "use-intl";
import {
  forumCall,
  runForumCall,
  toastForumFailure,
} from "@/components/tenant/classes/forum/call";
import type { ForumMessage } from "@/components/tenant/classes/forum/optimistic";
import { useChannelScope } from "@/components/tenant/classes/forum/scope";
import { uploadAttachment } from "@/components/tenant/classes/forum/upload";

/**
 * One file on its way into the next message: what the tray shows of it, its address on this device,
 * which shows a picture before the server holds it, and the upload the server registered.
 */
const TrayFile = Schema.Struct({
  byteSize: Schema.Int,
  height: Schema.NullOr(Schema.Int),
  key: Schema.String,
  kind: AttachmentKind,
  name: Schema.String,
  preview: Schema.Option(Schema.String),
  upload: Schema.Option(Id("classroomUploads")),
  width: Schema.NullOr(Schema.Int),
});

/** The longest name a message keeps. */
const NAME_LIMIT = 160;

/** The file as its message shows it before the server answers, from what this device holds. */
export const shownFile = (
  file: TrayFile
): ForumMessage["attachments"][number] => ({
  address: Option.getOrNull(file.preview),
  byteSize: file.byteSize,
  height: file.height,
  kind: file.kind,
  name: file.name,
  thumbnail: Option.getOrNull(file.preview),
  width: file.width,
});

/** The kinds of file the picker offers for a document. */
export const DOCUMENT_ACCEPT =
  ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,application/pdf";

/** Says that a file larger than a message carries was not added. */
const refuseLarge = () =>
  Effect.sync(() =>
    toast.error({
      description: "library-file-size.description",
      title: "library-file-size.title",
    })
  );

/** Says that a file whose bytes name nothing a chat keeps was not added. */
const refuseType = () =>
  Effect.sync(() =>
    toast.error({
      description: "forum-file-type.description",
      title: "forum-file-type.title",
    })
  );

/** Says that the school's chats hold all the files they can. */
const refuseFull = () =>
  Effect.sync(() =>
    toast.error({
      description: "forum-file-quota.description",
      title: "forum-file-quota.title",
    })
  );

/**
 * The files of the next message, as a chat holds them above its field: each uploads as soon as it
 * is chosen, so the message itself goes out at once, a photo shows its picture, and a file that
 * fails leaves the tray and says why. The send waits until every file is in.
 */
export function useUploadTray() {
  const { classId, slug } = useChannelScope();
  const requestUrl = useMutation(classroom.forum.files.uploadUrl);
  const register = useAction(classroom.forum.files.register);
  const withdraw = useMutation(classroom.forum.files.withdraw);
  const [files, setFiles] = useState<readonly (typeof TrayFile.Type)[]>([]);

  /** Starts one file on its way. */
  const start = (file: File, key: string) => {
    setFiles((held) =>
      Arr.append(held, {
        byteSize: file.size,
        height: null,
        key,
        kind: "document",
        name: file.name,
        preview: Str.startsWith("image/")(file.type)
          ? Option.some(URL.createObjectURL(file))
          : Option.none(),
        upload: Option.none(),
        width: null,
      })
    );
    const uploaded = uploadAttachment(
      file,
      () => requestUrl({ classId, slug }),
      (sent) =>
        register({
          ...sent,
          classId,
          name: Str.slice(0, NAME_LIMIT)(Str.trim(file.name)),
          slug,
        })
    );
    return uploaded.pipe(
      Effect.map(({ height, registered, width }) =>
        setFiles((held) =>
          Arr.map(held, (found) =>
            found.key === key
              ? {
                  ...found,
                  byteSize: registered.byteSize,
                  height,
                  kind: registered.kind,
                  upload: Option.some(registered.id),
                  width,
                }
              : found
          )
        )
      ),
      Effect.tapError(() =>
        Effect.sync(() =>
          setFiles((held) => Arr.filter(held, (found) => found.key !== key))
        )
      ),
      Effect.catchTags({
        AttachmentRefused: refuseType,
        FileQuotaReached: refuseFull,
        FileSizeRefused: refuseLarge,
        FileTooLarge: refuseLarge,
      })
    );
  };

  /** Adds the chosen files, up to what one message carries. */
  const add = (chosen: readonly File[]) => {
    for (const file of Arr.take(chosen, ATTACHMENT_LIMIT - files.length)) {
      runForumCall(
        Effect.flatMap(randomUuid, (key) => start(file, key)),
        toastForumFailure
      );
    }
  };

  /** Takes one file out of the tray, and back from the server once it holds it. */
  const remove = (file: typeof TrayFile.Type) => {
    setFiles((held) => Arr.filter(held, (found) => found.key !== file.key));
    if (Option.isSome(file.upload)) {
      const uploadId = file.upload.value;
      runForumCall(
        forumCall(() => withdraw({ classId, slug, uploadId })),
        Fn.constVoid
      );
    }
  };

  return {
    add,
    clear: () => setFiles([]),
    files,
    remove,
    uploading: Arr.some(files, (file) => Option.isNone(file.upload)),
  };
}

/** The tray above the composer's field. */
export function UploadTray({
  files,
  onRemove,
}: {
  files: readonly (typeof TrayFile.Type)[];
  onRemove: (file: typeof TrayFile.Type) => void;
}) {
  const t = useTranslations("Classroom");

  if (Arr.isReadonlyArrayEmpty(files)) {
    return null;
  }
  return (
    <AttachmentGroup>
      {Arr.map(files, (file) => (
        <Attachment
          key={file.key}
          size="sm"
          state={Option.isNone(file.upload) ? "uploading" : "done"}
        >
          {Option.match(file.preview, {
            onNone: () => (
              <AttachmentMedia variant="icon">
                <HugeIcons icon={File02Icon} />
              </AttachmentMedia>
            ),
            onSome: (address) => (
              <AttachmentMedia variant="image">
                <img alt="" height={32} src={address} width={32} />
              </AttachmentMedia>
            ),
          })}
          <AttachmentContent>
            <AttachmentTitle>{file.name}</AttachmentTitle>
          </AttachmentContent>
          <AttachmentActions>
            <AttachmentAction
              aria-label={t("attach-remove", { name: file.name })}
              onClick={() => onRemove(file)}
              type="button"
            >
              <HugeIcons icon={Cancel01Icon} />
            </AttachmentAction>
          </AttachmentActions>
        </Attachment>
      ))}
    </AttachmentGroup>
  );
}
