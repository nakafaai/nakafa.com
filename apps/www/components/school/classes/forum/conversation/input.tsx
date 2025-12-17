"use client";

import { useOs } from "@mantine/hooks";
import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import {
  EmojiPicker,
  EmojiPickerContent,
  EmojiPickerFooter,
  EmojiPickerSearch,
} from "@repo/design-system/components/ui/emoji-picker";
import { SpinnerIcon } from "@repo/design-system/components/ui/icons";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@repo/design-system/components/ui/input-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import {
  type FileWithPreview,
  useFileUpload,
} from "@repo/design-system/hooks/use-file-upload";
import { cn, formatFileSize } from "@repo/design-system/lib/utils";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "convex/react";
import {
  ArrowUpIcon,
  FileUpIcon,
  PaperclipIcon,
  PlusIcon,
  ReplyIcon,
  SmilePlusIcon,
  XIcon,
} from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import {
  Activity,
  type ComponentProps,
  type ComponentRef,
  memo,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import * as z from "zod/mini";
import { useForum } from "@/lib/context/use-forum";
import { useForumScrollContext } from "@/lib/context/use-forum-scroll";

export const ForumPostInput = memo(
  ({ forumId }: { forumId: Id<"schoolClassForums"> }) => {
    const t = useTranslations("School.Classes");
    const replyTo = useForum((f) => f.replyTo);
    const setReplyTo = useForum((f) => f.setReplyTo);
    const exitJumpMode = useForum((f) => f.exitJumpMode);
    const forumScroll = useForumScrollContext();

    const textareaRef = useRef<ComponentRef<typeof InputGroupTextarea>>(null);
    const createPost = useMutation(api.classes.mutations.createForumPost);
    const [
      { files },
      { removeFile, clearFiles, openFileDialog, getInputProps },
    ] = useFileUpload({
      multiple: true,
      accept: "image/*,.pdf,.doc,.docx,.txt",
      maxSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 10,
      onError: (errors) => {
        for (const error of errors) {
          toast.error(error, { position: "bottom-center" });
        }
      },
    });

    const [emojiOpen, setEmojiOpen] = useState(false);
    const os = useOs();
    const isMobile = os === "ios" || os === "android";

    // Auto-focus textarea when replyTo changes
    useEffect(() => {
      if (replyTo) {
        textareaRef.current?.focus();
      }
    }, [replyTo]);

    const form = useForm({
      defaultValues: {
        body: "",
      },
      validators: {
        onChange: z.object({
          body: z.string().check(z.minLength(1), z.trim()),
        }),
      },
      onSubmit: async ({ value }) => {
        await createPost({
          forumId,
          body: value.body,
          parentId: replyTo?.postId,
        });
        form.reset();
        clearFiles();
        setReplyTo(null);
        exitJumpMode();

        // Auto-scroll to bottom after sending my own message
        requestAnimationFrame(() => {
          forumScroll?.scrollToBottom();
        });
      },
    });

    return (
      <form
        className="grid shrink-0 px-2 pb-2"
        onSubmit={(e) => {
          e.preventDefault();
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
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
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
                    autoFocus
                    className="scrollbar-hide max-h-36 min-h-0"
                    disabled={isSubmitting}
                    name={field.name}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        form.handleSubmit();
                      }
                    }}
                    placeholder={t("send-message-placeholder")}
                    ref={textareaRef}
                    value={field.state.value}
                  />
                  <InputGroupAddon align="inline-end">
                    <Popover onOpenChange={setEmojiOpen} open={emojiOpen}>
                      <PopoverTrigger asChild>
                        <InputGroupButton
                          size="icon"
                          type="button"
                          variant="ghost"
                        >
                          <SmilePlusIcon />
                          <span className="sr-only">{t("emoji")}</span>
                        </InputGroupButton>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-fit p-0">
                        <EmojiPicker
                          className="h-80"
                          onEmojiSelect={({ emoji }) => {
                            field.handleChange(field.state.value + emoji);
                            setEmojiOpen(false);
                            textareaRef.current?.focus();
                          }}
                        >
                          <EmojiPickerSearch />
                          <EmojiPickerContent />
                          <EmojiPickerFooter />
                        </EmojiPicker>
                      </PopoverContent>
                    </Popover>
                    <Activity mode={isMobile ? "visible" : "hidden"}>
                      <InputGroupButton
                        disabled={isSubmitting || !field.state.value.trim()}
                        size="icon"
                        type="submit"
                        variant="default"
                      >
                        {isSubmitting ? <SpinnerIcon /> : <ArrowUpIcon />}
                        <span className="sr-only">{t("submit")}</span>
                      </InputGroupButton>
                    </Activity>
                  </InputGroupAddon>
                </InputGroup>
              )}
            </form.Subscribe>
          )}
        </form.Field>
      </form>
    );
  }
);
ForumPostInput.displayName = "ForumPostInput";

const AttachmentPreviews = memo(
  ({
    files,
    hasReplyTo,
    onRemove,
  }: {
    files: FileWithPreview[];
    hasReplyTo: boolean;
    onRemove: (id: string) => void;
  }) => {
    const t = useTranslations("File");

    if (files.length === 0) {
      return null;
    }

    return (
      <div
        aria-live="polite"
        className={cn(
          "scrollbar-hide flex items-center gap-2 overflow-x-auto border-x border-t p-3",
          !hasReplyTo && "rounded-t-md"
        )}
      >
        {files.map(({ id, file, preview }) => {
          const isImage = file.type.startsWith("image/");

          return (
            <div
              className="group relative flex shrink-0 items-center gap-2 rounded-md border bg-background p-2"
              key={id}
            >
              <Activity mode={isImage ? "hidden" : "visible"}>
                <div className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-muted">
                  <PaperclipIcon className="size-4 text-muted-foreground" />
                </div>
              </Activity>
              <Activity mode={isImage ? "visible" : "hidden"}>
                <div className="relative size-8 shrink-0 overflow-hidden rounded-sm border bg-muted">
                  <Image
                    alt={file.name || t("unknown-file")}
                    className="object-cover"
                    fill
                    loading="eager"
                    preload
                    src={preview || ""}
                  />
                </div>
              </Activity>
              <div className="flex min-w-0 max-w-32 flex-col">
                <span className="truncate font-medium text-xs">
                  {file.name || t("unknown-file")}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {formatFileSize(file.size)}
                </span>
              </div>

              <Button
                aria-label="Remove attachment"
                className="absolute -top-2 -right-2 z-1 opacity-0 transition-opacity ease-out group-hover:opacity-100"
                onClick={() => onRemove(id)}
                size="icon-xs"
                type="button"
                variant="outline"
              >
                <XIcon />
              </Button>
            </div>
          );
        })}
      </div>
    );
  }
);
AttachmentPreviews.displayName = "AttachmentPreviews";

const InputAttachments = memo(
  ({
    onOpenFiles,
    ...props
  }: ComponentProps<typeof InputGroupButton> & {
    onOpenFiles: () => void;
  }) => {
    const t = useTranslations("School.Classes");

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <InputGroupButton
            size="icon"
            type="button"
            variant="ghost"
            {...props}
          >
            <PlusIcon />
            <span className="sr-only">{t("attachments")}</span>
          </InputGroupButton>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start">
          <DropdownMenuItem className="cursor-pointer" onSelect={onOpenFiles}>
            <FileUpIcon />
            {t("attachments")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
);
InputAttachments.displayName = "InputAttachments";

const ReplyIndicator = memo(() => {
  const t = useTranslations("Common");
  const replyTo = useForum((f) => f.replyTo);
  const setReplyTo = useForum((f) => f.setReplyTo);

  if (!replyTo) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 overflow-hidden rounded-t-md border-x border-t bg-[color-mix(in_oklch,var(--secondary)_10%,var(--background))] px-3 py-2 text-sm">
      <ReplyIcon className="size-4 text-muted-foreground" />
      <p className="min-w-0 flex-1 truncate text-muted-foreground">
        {t.rich("replying-to-user", {
          name: () => (
            <span className="font-medium text-primary">{replyTo.userName}</span>
          ),
        })}
      </p>
      <Button
        onClick={() => setReplyTo(null)}
        size="icon-xs"
        type="button"
        variant="ghost"
      >
        <span className="sr-only">{t("cancel")}</span>
        <XIcon />
      </Button>
    </div>
  );
});
ReplyIndicator.displayName = "ReplyIndicator";
