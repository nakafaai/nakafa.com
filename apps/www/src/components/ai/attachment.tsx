import {
  AttachmentIcon,
  Cancel01Icon,
  FileIcon,
} from "@hugeicons/core-free-icons";
import { Image } from "@repo/design-system/components/image";
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger,
} from "@repo/design-system/components/ui/attachment";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { InputGroupButton } from "@repo/design-system/components/ui/input-group";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { usePromptInputAttachments } from "@repo/design-system/lib/prompt-input/context";
import type {
  PromptInputFile,
  PromptInputRefusal,
} from "@repo/design-system/lib/prompt-input/files";
import type { FileUIPart } from "ai";
import { cva, type VariantProps } from "class-variance-authority";
import { type ReactNode, useEffect, useRef } from "react";
import { useTranslations } from "use-intl";
import { refusalReason, splitFileName } from "@/components/ai/attachments";
import { useAi } from "@/components/ai/context";

// A chip in the composer sits inside the composer's own border, so it draws no
// frame: no border and no background of its own. The `preview` variant keeps
// the size of the chip. A document's state shows in its icon tile and its text;
// a picture shows a failure with the wash of its media variant.
const imageVariants = cva("", {
  variants: {
    variant: {
      message: "w-48",
      preview:
        "w-24 border-transparent bg-transparent p-0 has-data-[slot=attachment-media]:p-0 has-[>a,>button]:hover:bg-transparent data-[state=error]:border-transparent",
    },
  },
  defaultVariants: { variant: "message" },
});

/**
 * The width of a document chip: 10rem to 16rem. In the composer the row is as
 * wide as the composer, and on a narrow screen both give way to it, so a chip
 * never runs past the composer's edge. A sent message's row is as wide as its
 * files and scrolls, so there the chip keeps its own sizes.
 */
const documentVariants = cva("", {
  variants: {
    variant: {
      message: "max-w-64",
      preview:
        "min-w-[min(100%,--spacing(40))] max-w-[min(100%,--spacing(64))] border-transparent bg-transparent has-[>a,>button]:hover:bg-transparent data-[state=error]:border-transparent",
    },
  },
  defaultVariants: { variant: "message" },
});

/**
 * The picture of an image chip in the composer is the chip itself: it takes the
 * chip's corners, and a transparent picture sits on the media's own backdrop, so
 * its ink keeps its contrast in both themes.
 */
const imageMediaVariants = cva("", {
  variants: {
    variant: {
      message: "aspect-3/2",
      preview: "rounded-md",
    },
  },
  defaultVariants: { variant: "message" },
});

/**
 * The two parts of a file name for a flex row: the start gives way first, so
 * the version and the extension stay in view. The end never takes more than
 * the row: where the characters at the end are wider than the row, it shortens
 * with an ellipsis.
 */
function FileNameParts({ name }: { name: string }) {
  const { head, tail } = splitFileName(name);
  return (
    <>
      <span className="truncate">{head}</span>
      <span className="max-w-full shrink-0 overflow-hidden text-ellipsis whitespace-pre">
        {tail}
      </span>
    </>
  );
}

/** The icon of a document, or a spinner while the document uploads. */
function NinaFileMedia({ uploading }: { uploading: boolean }) {
  const tCommon = useTranslations("Common");

  return uploading ? (
    <Spinner label={tCommon("loading")} />
  ) : (
    <HugeIcons icon={FileIcon} />
  );
}

/**
 * A file a prompt shows: a saved one, or one the learner just picked. A picked
 * file holds the id the composer gave it, which is the key of its upload state,
 * and a prompt that is still on its way shows it with that id.
 */
type NinaFile = FileUIPart | PromptInputFile;

/** Shadcn owns attachment composition; Nina supplies the native Agent file. */
export function NinaAttachment({
  children,
  file,
  variant = "message",
}: { children?: ReactNode; file: NinaFile } & VariantProps<
  typeof imageVariants
>) {
  const t = useTranslations("Ai");
  const name = file.filename ?? t("attachment");
  const isImage = file.mediaType.startsWith("image/");
  // A saved file has no id and is never uploading. A picked file that is
  // neither uploading nor failed has no entry and shows as done.
  const fileId = "id" in file ? file.id : undefined;
  const state =
    useAi((store) =>
      fileId === undefined ? undefined : store.uploads[fileId]
    ) ?? "done";
  return (
    <Attachment
      className={
        isImage ? imageVariants({ variant }) : documentVariants({ variant })
      }
      orientation={isImage ? "vertical" : "horizontal"}
      state={state}
    >
      <AttachmentMedia
        className={isImage ? imageMediaVariants({ variant }) : undefined}
        variant={isImage ? "image" : "icon"}
      >
        {isImage ? (
          <Image
            alt={name}
            fill
            sizes={variant === "preview" ? "96px" : "192px"}
            src={file.url}
          />
        ) : (
          <NinaFileMedia uploading={state === "uploading"} />
        )}
      </AttachmentMedia>
      {isImage ? null : (
        <AttachmentContent>
          <AttachmentTitle className="flex" dir="auto">
            <FileNameParts name={name} />
          </AttachmentTitle>
          <AttachmentDescription>{file.mediaType}</AttachmentDescription>
        </AttachmentContent>
      )}
      {children}
      <AttachmentTrigger
        render={
          <a
            aria-label={t("open-attachment", { filename: name })}
            href={file.url}
            rel="noopener noreferrer"
            target="_blank"
            title={name}
          />
        }
      />
    </Attachment>
  );
}

/**
 * A file that a pick refused, in the tray and in its refused state: its name,
 * and the reason in the text under it. It never uploads, and its own remove
 * button takes it out of the tray.
 */
export function NinaRefusedAttachment({
  onRemove,
  refusal,
}: {
  onRemove: () => void;
  refusal: PromptInputRefusal;
}) {
  const t = useTranslations("Ai");
  return (
    <Attachment
      className={documentVariants({ variant: "preview" })}
      state="error"
    >
      <AttachmentMedia variant="icon">
        <HugeIcons icon={FileIcon} />
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle className="flex" dir="auto">
          <FileNameParts name={refusal.name} />
        </AttachmentTitle>
        <AttachmentDescription>
          {refusalReason(refusal.code, t)}
        </AttachmentDescription>
      </AttachmentContent>
      <AttachmentActions>
        <AttachmentAction
          aria-label={t("remove-attachment", { filename: refusal.name })}
          onClick={onRemove}
          type="button"
          variant="secondary"
        >
          <HugeIcons icon={Cancel01Icon} />
        </AttachmentAction>
      </AttachmentActions>
    </Attachment>
  );
}

export function NinaAttach() {
  const openFileDialog = usePromptInputAttachments(
    (attachments) => attachments.openFileDialog
  );
  const t = useTranslations("Ai");
  return (
    <InputGroupButton
      aria-label={t("attach-files")}
      className="rounded-full"
      onClick={openFileDialog}
      size="icon"
      type="button"
      variant="outline"
    >
      <HugeIcons icon={AttachmentIcon} />
    </InputGroupButton>
  );
}

/**
 * Opens the composer's file picker once, for an attach the learner pressed
 * before this composer mounted, then runs `onOpen`. A browser opens a picker
 * only within a short time after a press, so it opens as soon as it mounts.
 */
export function NinaHeldAttach({ onOpen }: { onOpen?: () => void }) {
  const openFileDialog = usePromptInputAttachments(
    (attachments) => attachments.openFileDialog
  );
  const opened = useRef(false);

  useEffect(() => {
    if (opened.current) {
      return;
    }
    opened.current = true;
    openFileDialog();
    onOpen?.();
  }, [onOpen, openFileDialog]);

  return null;
}
