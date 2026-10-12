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
import type { FileUIPart } from "ai";
import { cva, type VariantProps } from "class-variance-authority";
import { Array as Arr, Effect, HashSet } from "effect";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { splitFileName } from "@/components/ai/attachments";
import { useAi } from "@/components/ai/context";
import { releaseUploads } from "@/components/ai/uploads";

const imageVariants = cva("", {
  variants: { variant: { message: "w-48", preview: "w-24" } },
  defaultVariants: { variant: "message" },
});

/**
 * A file name whose start gives way first, so its version and extension stay
 * in view. The end never takes more than the title: where the characters at
 * the end are wider than the title, it shortens with an ellipsis.
 */
function NinaFileName({ name }: { name: string }) {
  const { head, tail } = splitFileName(name);
  return (
    <AttachmentTitle className="flex" dir="auto">
      <span className="truncate">{head}</span>
      <span className="max-w-full shrink-0 overflow-hidden text-ellipsis whitespace-pre">
        {tail}
      </span>
    </AttachmentTitle>
  );
}

/** The icon of a document, or a spinner while the document uploads. */
function NinaFileMedia({ uploading }: { uploading: boolean }) {
  return uploading ? <Spinner /> : <HugeIcons icon={FileIcon} />;
}

/** Shadcn owns attachment composition; Nina supplies the native Agent file. */
export function NinaAttachment({
  children,
  file,
  variant = "message",
}: { children?: ReactNode; file: FileUIPart } & VariantProps<
  typeof imageVariants
>) {
  const t = useTranslations("Ai");
  const name = file.filename ?? t("attachment");
  const isImage = file.mediaType.startsWith("image/");
  // A file that is neither uploading nor failed has no entry and shows as done.
  const state = useAi((store) => store.uploads[file.url]) ?? "done";
  return (
    <Attachment
      className={isImage ? imageVariants({ variant }) : "max-w-64"}
      orientation={isImage ? "vertical" : "horizontal"}
      state={state}
    >
      <AttachmentMedia
        className={isImage && variant === "message" ? "aspect-3/2" : undefined}
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
 * The reasons one pick was not attached in full. Each reason has its sentence
 * and the names of the files it dropped, one to a line, and how many more.
 */
export function RejectedFiles({
  reasons,
}: {
  reasons: readonly {
    more: string | null;
    names: readonly string[];
    sentence: string;
  }[];
}) {
  return (
    <ul className="flex flex-col gap-2">
      {Arr.map(reasons, (reason) => (
        <li key={reason.sentence}>
          <p>{reason.sentence}</p>
          <ul className="flex flex-col gap-0.5 font-medium">
            {Arr.map(Arr.dedupe(reason.names), (name) => (
              <li className="wrap-anywhere" key={name}>
                {name}
              </li>
            ))}
            {reason.more ? <li>{reason.more}</li> : null}
          </ul>
        </li>
      ))}
    </ul>
  );
}

/** Selected files remain editable when upload or message admission fails. */
export function NinaAttachments({
  submittedFiles,
}: {
  submittedFiles: readonly string[];
}) {
  const attachedFiles = usePromptInputAttachments(
    (attachments) => attachments.files
  );
  const removeAttachment = usePromptInputAttachments(
    (attachments) => attachments.remove
  );
  const clearUpload = useAi((state) => state.clearUpload);
  const takeUploads = useAi((state) => state.takeUploads);
  const release = useMutation(nina.uploads.release);
  const t = useTranslations("Ai");
  const submitted = HashSet.fromIterable(submittedFiles);
  const files = Arr.filter(
    attachedFiles,
    (file) => !HashSet.has(submitted, file.id)
  );
  if (files.length === 0) {
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
                clearUpload(file.url);
                // The upload the file holds goes back at once, not at expiry.
                Effect.runFork(releaseUploads(takeUploads([file.id]), release));
              }}
              type="button"
              variant="secondary"
            >
              <HugeIcons icon={Cancel01Icon} />
            </AttachmentAction>
          </AttachmentActions>
        </NinaAttachment>
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
