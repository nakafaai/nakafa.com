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
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { usePromptInputAttachments } from "@repo/design-system/lib/prompt-input/context";
import type { PromptInputFile } from "@repo/design-system/lib/prompt-input/files";
import type { FileUIPart } from "ai";
import { cva, type VariantProps } from "class-variance-authority";
import { Array as Arr, Effect, HashSet } from "effect";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import {
  type rejectionNotice,
  splitFileName,
} from "@/components/ai/attachments";
import { useAi } from "@/components/ai/context";
import { releaseUploads } from "@/components/ai/uploads";

const imageVariants = cva("", {
  variants: { variant: { message: "w-48", preview: "w-24" } },
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
export type NinaFile = FileUIPart | PromptInputFile;

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
 * The files one pick did not attach, grouped by the reason that dropped them.
 * Each reason heads its group in the quiet color of a description, and every
 * dropped file is named on a line of its own with its end in view.
 *
 * The list scrolls inside itself past ten lines, or seven on a screen at most
 * 34rem tall, so a pick of many files never makes the notice taller than the
 * page. While it scrolls, the reason of the group in view stays at the top of
 * the list, on the error background the toaster gives the notice, so that no
 * name shows through it. Every line is as tall as the height counts it, and the
 * list snaps to them, so it comes to rest with whole names under the reason,
 * never half of one.
 *
 * The end of the list fades while more follows, which tells the learner that
 * the list goes on without a count. Its start does not fade, because the
 * reason that stays there would fade with it.
 */
export function RejectedFiles({
  reasons,
}: {
  reasons: ReturnType<typeof rejectionNotice>["reasons"];
}) {
  return (
    <ScrollArea
      scrollFade="end"
      viewportClassName="max-h-[10lh] snap-y snap-mandatory leading-4.5 [@media(max-height:34rem)]:max-h-[7lh]"
    >
      {/* Names are the only other places to rest, and the first of them rests
          under the first reason, so this empty line lets the list return to its top. */}
      <div aria-hidden="true" className="snap-start" />
      <dl>
        {Arr.map(reasons, (entry) => (
          <div key={entry.reason}>
            <dt className="sticky top-0 bg-(--error-bg)">{entry.reason}</dt>
            {Arr.map(entry.names, (name) => (
              <dd
                className="flex snap-start text-popover-foreground"
                dir="auto"
                key={name}
                title={name}
              >
                <FileNameParts name={name} />
              </dd>
            ))}
          </div>
        ))}
      </dl>
    </ScrollArea>
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
                clearUpload(file.id);
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
