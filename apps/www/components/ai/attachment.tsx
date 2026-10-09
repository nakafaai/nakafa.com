"use client";

import {
  AttachmentIcon,
  Cancel01Icon,
  FileIcon,
} from "@hugeicons/core-free-icons";
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
import { usePromptInputAttachments } from "@repo/design-system/lib/prompt-input/context";
import type { FileUIPart } from "ai";
import { cva, type VariantProps } from "class-variance-authority";
import { Array as Arr, HashSet } from "effect";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

const imageVariants = cva("", {
  variants: { variant: { message: "w-48", preview: "w-24" } },
  defaultVariants: { variant: "message" },
});

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
  return (
    <Attachment
      className={isImage ? imageVariants({ variant }) : "max-w-64"}
      orientation={isImage ? "vertical" : "horizontal"}
    >
      <AttachmentMedia
        className={isImage && variant === "message" ? "aspect-3/2" : undefined}
        variant={isImage ? "image" : "icon"}
      >
        {isImage ? (
          <Image
            alt={name}
            className="object-contain!"
            fill
            sizes={variant === "preview" ? "96px" : "192px"}
            src={file.url}
            unoptimized
          />
        ) : (
          <HugeIcons icon={FileIcon} />
        )}
      </AttachmentMedia>
      {isImage ? null : (
        <AttachmentContent>
          <AttachmentTitle>{name}</AttachmentTitle>
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
          />
        }
      />
    </Attachment>
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
              onClick={() => removeAttachment(file.id)}
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
