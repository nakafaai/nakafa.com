"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { SpinnerIcon } from "@repo/design-system/components/ui/icons";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@repo/design-system/components/ui/input-group";
import { cn } from "@repo/design-system/lib/utils";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "convex/react";
import {
  ArrowUpIcon,
  FileUpIcon,
  PlusIcon,
  ReplyIcon,
  XIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  type ComponentProps,
  type ComponentRef,
  memo,
  useEffect,
  useRef,
} from "react";
import * as z from "zod/mini";
import { useForum } from "@/lib/context/use-forum";
import { useForumScrollContext } from "@/lib/context/use-forum-scroll";

// ============================================================================
// ForumPostInput
// ============================================================================

export const ForumPostInput = memo(
  ({ forumId }: { forumId: Id<"schoolClassForums"> }) => {
    const t = useTranslations("School.Classes");
    const replyTo = useForum((f) => f.replyTo);
    const setReplyTo = useForum((f) => f.setReplyTo);
    const exitJumpMode = useForum((f) => f.exitJumpMode);
    const forumScroll = useForumScrollContext();

    const textareaRef = useRef<ComponentRef<typeof InputGroupTextarea>>(null);
    const createPost = useMutation(api.classes.mutations.createForumPost);

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

        <form.Field name="body">
          {(field) => (
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <InputGroup className={cn(!!replyTo && "rounded-t-none")}>
                  <InputAttachments disabled={isSubmitting} />
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
                    <InputGroupButton
                      disabled={isSubmitting || !field.state.value.trim()}
                      size="icon"
                      type="submit"
                      variant="default"
                    >
                      {isSubmitting ? <SpinnerIcon /> : <ArrowUpIcon />}
                      <span className="sr-only">{t("submit")}</span>
                    </InputGroupButton>
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

// ============================================================================
// InputAttachments
// ============================================================================

const InputAttachments = memo(
  ({ ...props }: ComponentProps<typeof InputGroupButton>) => {
    const t = useTranslations("School.Classes");
    return (
      <InputGroupAddon align="inline-start">
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
            <DropdownMenuItem className="cursor-pointer">
              <FileUpIcon /> {t("attachments")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </InputGroupAddon>
    );
  }
);
InputAttachments.displayName = "InputAttachments";

// ============================================================================
// ReplyIndicator
// ============================================================================

const ReplyIndicator = memo(() => {
  const t = useTranslations("Common");
  const replyTo = useForum((f) => f.replyTo);
  const setReplyTo = useForum((f) => f.setReplyTo);

  if (!replyTo) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 overflow-hidden rounded-t-md border-x border-t bg-muted px-3 py-2 text-sm">
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
