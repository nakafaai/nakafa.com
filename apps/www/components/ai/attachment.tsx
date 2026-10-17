"use client";

import { useMutation } from "@confect/react";
import {
  AttachmentIcon,
  Cancel01Icon,
  FileIcon,
} from "@hugeicons/core-free-icons";
import nina from "@repo/backend/confect/_generated/refs/nina";
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
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
import { Array as Arr, Effect, HashSet } from "effect";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { refusalReason, splitFileName } from "@/components/ai/attachments";
import { useAi } from "@/components/ai/context";
import { releaseUploads } from "@/components/ai/uploads";

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

/** The name of a file in its chip. */
function NinaFileName({ name }: { name: string }) {
  return (
    <AttachmentTitle className="flex" dir="auto">
      <FileNameParts name={name} />
    </AttachmentTitle>
  );
}

/** The icon of a document, or a spinner while the document uploads. */
function NinaFileMedia({ uploading }: { uploading: boolean }) {
  return uploading ? <Spinner /> : <HugeIcons icon={FileIcon} />;
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
            unoptimized
          />
        ) : (
          <NinaFileMedia uploading={state === "uploading"} />
        )}
      </AttachmentMedia>
      {isImage ? null : (
        <AttachmentContent>
          <NinaFileName name={name} />
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
function NinaRefusedAttachment({
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
        <NinaFileName name={refusal.name} />
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

/**
 * The files of a composer's tray: the files it attached, which upload and stay
 * until the message goes, and the files the last pick refused.
 */
export function NinaAttachments({
  submittedFiles,
}: {
  submittedFiles: readonly string[];
}) {
  const attachedFiles = usePromptInputAttachments(
    (attachments) => attachments.files
  );
  const refusals = usePromptInputAttachments(
    (attachments) => attachments.refusals
  );
  const removeAttachment = usePromptInputAttachments(
    (attachments) => attachments.remove
  );
  const clearUpload = useAi((state) => state.clearUpload);
  const forgetUploads = useAi((state) => state.forgetUploads);
  const readUploads = useAi((state) => state.readUploads);
  const release = useMutation(nina.uploads.release);
  const t = useTranslations("Ai");
  const submitted = HashSet.fromIterable(submittedFiles);
  const files = Arr.filter(
    attachedFiles,
    (file) => !HashSet.has(submitted, file.id)
  );
  if (files.length === 0 && refusals.length === 0) {
    return null;
  }
  return (
    <AttachmentGroup className="w-full justify-start px-3 pt-3">
      {Arr.map(files, (file) => (
        <NinaAttachment file={file} key={file.id} variant="preview">
          <AttachmentActions>
            <AttachmentAction
              aria-label={t("remove-attachment", { filename: file.file.name })}
              onClick={() => {
                removeAttachment(file.id);
                clearUpload(file.id);
                // The upload the file holds goes back at once, not at expiry,
                // and its hold is forgotten once the server gave its place back.
                Effect.runFork(
                  releaseUploads(readUploads([file.id]), release).pipe(
                    Effect.tap((given) =>
                      Effect.sync(() => forgetUploads(given))
                    )
                  )
                );
              }}
              type="button"
              variant="secondary"
            >
              <HugeIcons icon={Cancel01Icon} />
            </AttachmentAction>
          </AttachmentActions>
        </NinaAttachment>
      ))}
      {Arr.map(refusals, (refusal) => (
        <NinaRefusedAttachment
          key={refusal.id}
          onRemove={() => removeAttachment(refusal.id)}
          refusal={refusal}
        />
      ))}
    </AttachmentGroup>
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
