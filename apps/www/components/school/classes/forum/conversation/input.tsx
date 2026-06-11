import { ArrowUp01Icon } from "@hugeicons/core-free-icons";
import { useDisclosure, useOs } from "@mantine/hooks";
import { captureException } from "@repo/analytics/posthog";
import { api } from "@repo/backend/convex/_generated/api";
import {
  MAX_FORUM_ATTACHMENT_BYTES,
  MAX_FORUM_POST_ATTACHMENTS,
} from "@repo/backend/convex/classes/forums/utils/constants";
import { Button } from "@repo/design-system/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupTextarea,
} from "@repo/design-system/components/ui/input-group";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { toastManager } from "@repo/design-system/components/ui/toast";
import { useFileUpload } from "@repo/design-system/hooks/use-file-upload";
import { cn } from "@repo/design-system/lib/utils";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "convex/react";
import { Effect, Either, Schema } from "effect";
import { useTranslations } from "next-intl";
import { Activity, type ComponentRef, useEffect, useRef } from "react";
import { useForumSession } from "@/components/school/classes/forum/context/use-session";
import { useControls } from "@/components/school/classes/forum/conversation/context/use-controls";
import { useData } from "@/components/school/classes/forum/conversation/context/use-data";
import { AttachmentPreviews } from "@/components/school/classes/forum/conversation/input/attachment-previews";
import { InputAttachments } from "@/components/school/classes/forum/conversation/input/attachments-trigger";
import { EmojiButton } from "@/components/school/classes/forum/conversation/input/emoji-button";
import { ReplyIndicator } from "@/components/school/classes/forum/conversation/input/reply-indicator";
import { submitForumPost } from "@/components/school/classes/forum/conversation/input/submit";

/** Handles forum post submission, uploads, and reply cleanup for the transcript. */
export const ForumPostInput = () => {
  const t = useTranslations("School.Classes");
  const { acknowledgeUnreadCue, goToLatest } = useControls();
  const forumId = useData((state) => state.forumId);
  const replyTarget = useForumSession(
    (state) => state.replyTargetByForumId[forumId] ?? null
  );
  const setForumReplyTarget = useForumSession(
    (state) => state.setForumReplyTarget
  );
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
          toastManager.add({ type: "error", title: error });
        }
      },
    });
  const [isEmojiPickerOpen, emojiPicker] = useDisclosure(false);
  const os = useOs();
  const isMobile = os === "ios" || os === "android";

  useEffect(() => {
    if (replyTarget) {
      textareaRef.current?.focus();
    }
  }, [replyTarget]);

  const form = useForm({
    defaultValues: { body: "" },
    validators: {
      onSubmit: Schema.standardSchemaV1(
        Schema.Struct({
          body: Schema.String,
        })
      ),
    },
    onSubmit: async ({ value }) => {
      const hasBody = value.body.trim().length > 0;
      const hasAttachments = files.length > 0;

      if (!(hasBody || hasAttachments)) {
        return;
      }

      const result = await Effect.runPromise(
        Effect.either(
          submitForumPost({
            files,
            mutations: {
              createPost,
              discardForumUploads,
              generateUploadUrl,
              saveForumUpload,
            },
            post: {
              body: value.body,
              forumId,
              parentId: replyTarget?.postId,
            },
          })
        )
      );

      if (Either.isLeft(result)) {
        captureException(result.left, {
          source: "forum-post-submit",
        });
        toastManager.add({ type: "error", title: t("create-post-failed") });

        requestAnimationFrame(() => {
          textareaRef.current?.focus();
        });

        return;
      }

      form.reset();
      clearFiles();
      setForumReplyTarget(forumId, null);
      acknowledgeUnreadCue();

      requestAnimationFrame(() => {
        textareaRef.current?.focus();
        goToLatest();
      });
    },
  });

  return (
    <form
      action={() => form.handleSubmit()}
      className="grid shrink-0 px-2 pb-2"
    >
      <ReplyIndicator />
      <AttachmentPreviews
        files={files}
        hasReplyTo={!!replyTarget}
        onRemove={removeFile}
      />
      <input className="hidden" {...getInputProps()} />

      <form.Field name="body">
        {(field) => (
          <form.Subscribe
            selector={(state) => ({
              isSubmitting: state.isSubmitting,
              body: state.values.body,
            })}
          >
            {({ isSubmitting, body }) => {
              const canSubmit = body.trim().length > 0 || files.length > 0;
              const submitDisabled = isSubmitting || !canSubmit;

              return (
                <InputGroup
                  className={cn(
                    "**:[textarea]:scrollbar-hide **:[textarea]:max-h-36 **:[textarea]:min-h-9 **:[textarea]:overflow-y-auto **:[textarea]:py-2",
                    (!!replyTarget || files.length > 0) && "rounded-t-none"
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
                    rows={1}
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
                      <Button
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
                      </Button>
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
};
