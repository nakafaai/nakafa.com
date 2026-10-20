"use client";

import { useMutation } from "@confect/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import nina from "@repo/backend/confect/_generated/refs/nina";
import {
  AttachmentAction,
  AttachmentActions,
  AttachmentGroup,
} from "@repo/design-system/components/ui/attachment";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { usePromptInputAttachments } from "@repo/design-system/lib/prompt-input/context";
import { Array as Arr, Effect, HashSet } from "effect";
import { useTranslations } from "use-intl";
import {
  NinaAttachment,
  NinaRefusedAttachment,
} from "@/components/ai/attachment";
import { useAi } from "@/components/ai/context";
import { releaseUploads } from "@/components/ai/uploads";

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
