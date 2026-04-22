import { ArrowUp01Icon } from "@hugeicons/core-free-icons";
import { useDisclosure, useOs } from "@mantine/hooks";
import { captureException } from "@repo/analytics/posthog";
import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import {
  MAX_FORUM_ATTACHMENT_BYTES,
  MAX_FORUM_POST_ATTACHMENTS,
} from "@repo/backend/convex/classes/forums/utils/constants";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@repo/design-system/components/ui/input-group";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { useFileUpload } from "@repo/design-system/hooks/use-file-upload";
import { cn } from "@repo/design-system/lib/utils";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "convex/react";
import ky from "ky";
import { useTranslations } from "next-intl";
import {
  Activity,
  type ComponentRef,
  memo,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { toast } from "sonner";
import * as z from "zod/mini";
import { useControls } from "@/components/school/classes/forum/conversation/context/use-controls";
import { useData } from "@/components/school/classes/forum/conversation/context/use-data";
import { useSession } from "@/components/school/classes/forum/conversation/context/use-session";
import { AttachmentPreviews } from "@/components/school/classes/forum/conversation/input/attachment-previews";
import { InputAttachments } from "@/components/school/classes/forum/conversation/input/attachments-trigger";
import { EmojiButton } from "@/components/school/classes/forum/conversation/input/emoji-button";
import { ReplyIndicator } from "@/components/school/classes/forum/conversation/input/reply-indicator";

/** Handles forum post submission, uploads, and reply cleanup for the transcript. */
export const ForumPostInput = memo(() => {
  const t = useTranslations("School.Classes");
  const replyTo = useSession((state) => state.replyTo);
  const setReplyTo = useSession((state) => state.setReplyTo);
  const { goToLatest } = useControls();
  const forumId = useData((state) => state.forumId);
  const textareaRef = useRef<ComponentRef<typeof InputGroupTextarea>>(null);
  const generateUploadUrl = useMutation(
    api.classes.forums.mutations.uploads.generateUploadUrl
  );
  const discardForumUploads = useMutation(
    api.classes.forums.mutations.uploads.discardForumUploads
  );
  const saveForumUpload = useMutation(
    api.classes.forums.mutations.uploads.saveForumUpload
  );
  const createPost = useMutation(
    api.classes.forums.mutations.posts.createForumPost
  );
  const [{ files }, { removeFile, clearFiles, openFileDialog, getInputProps }] =
    useFileUpload({
      multiple: true,
      accept: "image/*,.pdf,.doc,.docx,.txt",
      maxSize: MAX_FORUM_ATTACHMENT_BYTES,
      maxFiles: MAX_FORUM_POST_ATTACHMENTS,
      onError: (errors) => {
        for (const error of errors) {
          toast.error(error, { position: "bottom-center" });
        }
      },
    });
  const [isEmojiPickerOpen, emojiPicker] = useDisclosure(false);
  const os = useOs();
  const isMobile = os === "ios" || os === "android";

  useEffect(() => {
    if (replyTo) {
      textareaRef.current?.focus();
    }
  }, [replyTo]);

  const uploadFile = useCallback(
    async (file: File) => {
      const { uploadId, uploadUrl } = await generateUploadUrl({ forumId });

      try {
        const { storageId } = await ky
          .post(uploadUrl, {
            headers: { "Content-Type": file.type },
            body: file,
          })
          .json<{ storageId: Id<"_storage"> }>();

        await saveForumUpload({
          name: file.name,
          size: file.size,
          type: file.type,
          storageId,
          uploadId,
        });

        return uploadId;
      } catch (error) {
        await discardForumUploads({ uploadIds: [uploadId] }).catch(
          (cleanupError) => {
            captureException(cleanupError, {
              source: "forum-upload-discard-single",
            });
            return null;
          }
        );
        throw error;
      }
    },
    [discardForumUploads, forumId, generateUploadUrl, saveForumUpload]
  );

  const form = useForm({
    defaultValues: { body: "" },
    validators: {
      onSubmit: z.object({
        body: z.string(),
      }),
    },
    onSubmit: async ({ value }) => {
      const hasBody = value.body.trim().length > 0;
      const hasAttachments = files.length > 0;

      if (!(hasBody || hasAttachments)) {
        return;
      }

      const attachmentUploadIds: Id<"schoolClassForumPendingUploads">[] = [];

      try {
        for (const fileWithPreview of files) {
          if (!(fileWithPreview.file instanceof File)) {
            continue;
          }

          attachmentUploadIds.push(await uploadFile(fileWithPreview.file));
        }

        await createPost({
          attachmentUploadIds:
            attachmentUploadIds.length > 0 ? attachmentUploadIds : undefined,
          forumId,
          body: value.body,
          parentId: replyTo?.postId,
        });

        form.reset();
        clearFiles();
        setReplyTo(null);

        requestAnimationFrame(() => {
          textareaRef.current?.focus();
          goToLatest();
        });
      } catch (error) {
        if (attachmentUploadIds.length > 0) {
          await discardForumUploads({ uploadIds: attachmentUploadIds }).catch(
            (cleanupError) => {
              captureException(cleanupError, {
                source: "forum-upload-discard-batch",
              });
              return null;
            }
          );
        }

        captureException(error, {
          source: "forum-post-submit",
        });
        toast.error(t("create-post-failed"));

        requestAnimationFrame(() => {
          textareaRef.current?.focus();
        });
      }
    },
  });

  return (
    <form
      className="grid shrink-0 px-2 pb-2"
      onSubmit={(event) => {
        event.preventDefault();
        form.handleSubmit();
      }}
    >
      <ReplyIndicator />
      <AttachmentPreviews
        files={files}
        hasReplyTo={!!replyTo}
        onRemove={removeFile}
      />
      <input className="hidden" {...getInputProps()} />

      <form.Field name="body">
        {(field) => (
          <form.Subscribe
            selector={(state) =>
              [state.isSubmitting, state.values.body] as const
            }
          >
            {([isSubmitting, body]) => {
              const canSubmit = body.trim().length > 0 || files.length > 0;
              const submitDisabled = isSubmitting || !canSubmit;

              return (
                <InputGroup
                  className={cn(
                    (!!replyTo || files.length > 0) && "rounded-t-none"
                  )}
                >
                  <InputGroupAddon align="inline-start">
                    <InputAttachments
                      disabled={isSubmitting}
                      onOpenFiles={openFileDialog}
                    />
                  </InputGroupAddon>
                  <InputGroupTextarea
                    aria-label={t("send-message-placeholder")}
                    autoFocus
                    className="scrollbar-hide max-h-36 min-h-0 py-2"
                    // `Textarea` wraps `react-textarea-autosize`, so explicit row
                    // bounds keep the composer compact instead of inheriting the
                    // base textarea's larger `min-h-16`.
                    maxRows={6}
                    minRows={1}
                    name={field.name}
                    onChange={(event) => field.handleChange(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.nativeEvent.isComposing) {
                        return;
                      }

                      if (event.key !== "Enter" || event.shiftKey) {
                        return;
                      }

                      event.preventDefault();

                      if (!submitDisabled) {
                        form.handleSubmit();
                      }
                    }}
                    placeholder={t("send-message-placeholder")}
                    readOnly={isSubmitting}
                    ref={textareaRef}
                    value={field.state.value}
                  />
                  <InputGroupAddon align="inline-end">
                    <EmojiButton
                      isMobile={isMobile}
                      isOpen={isEmojiPickerOpen}
                      isSubmitting={isSubmitting}
                      label={t("emoji")}
                      onAppendEmoji={(emoji) => {
                        field.handleChange(field.state.value + emoji);
                        emojiPicker.close();
                        textareaRef.current?.focus();
                      }}
                      onOpenChange={(open) => {
                        if (open) {
                          emojiPicker.open();
                          return;
                        }

                        emojiPicker.close();
                      }}
                    />
                    <Activity mode={isMobile ? "visible" : "hidden"}>
                      <InputGroupButton
                        disabled={submitDisabled}
                        size="icon"
                        type="submit"
                        variant="default"
                      >
                        <Spinner
                          icon={ArrowUp01Icon}
                          isLoading={isSubmitting}
                        />
                        <span className="sr-only">{t("submit")}</span>
                      </InputGroupButton>
                    </Activity>
                  </InputGroupAddon>
                </InputGroup>
              );
            }}
          </form.Subscribe>
        )}
      </form.Field>
    </form>
  );
});
ForumPostInput.displayName = "ForumPostInput";
