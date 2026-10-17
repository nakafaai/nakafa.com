"use client";

import { QueryResult, useQuery } from "@confect/react";
import {
  Copy01Icon,
  Globe02Icon,
  Link04Icon,
  Refresh03Icon,
  SquareLock01Icon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";
import { useClipboard } from "@mantine/hooks";
import chats from "@repo/backend/confect/_generated/refs/chats";
import type { ChatVisibility } from "@repo/backend/confect/chats/schema";
import type { ChatView } from "@repo/backend/confect/chats/view";
import { Button } from "@repo/design-system/components/ui/button";
import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { cn } from "cn";
import { Array as Arr, Effect } from "effect";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { shareLink } from "@/components/ai/chat/link";
import { useUpdateChatVisibilityMutation } from "@/components/ai/chat/mutation.client";
import { reportClientException } from "@/lib/analytics/client";

/**
 * The share dialog of one chat. A link the server could not load shows in the
 * dialog's footer, which offers to load it again, and never takes the chat page
 * with it.
 */
export function ChatSharing({
  chat,
  open,
  onOpenChange,
}: {
  chat: ChatView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <ErrorBoundary
      fallbackRender={({ resetErrorBoundary }) => (
        <ChatSharingError
          onOpenChange={onOpenChange}
          onRetry={resetErrorBoundary}
          open={open}
        />
      )}
    >
      <ChatSharingDialog chat={chat} onOpenChange={onOpenChange} open={open} />
    </ErrorBoundary>
  );
}

/**
 * The share dialog while the page itself failed. It says so in one sentence and
 * offers to load the link again, which asks the server anew.
 */
function ChatSharingError({
  open,
  onOpenChange,
  onRetry,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRetry: () => void;
}) {
  const t = useTranslations("Ai");

  return (
    <ResponsiveDialog
      description={t("share-link-error")}
      footer={
        <Button onClick={onRetry}>
          <HugeIcons icon={Refresh03Icon} />
          {t("retry")}
        </Button>
      }
      open={open}
      setOpen={onOpenChange}
      title={t("share-chat")}
    />
  );
}

/**
 * The share dialog of one chat. It stays mounted while its link loads, shows,
 * fails and loads again: only its footer changes between those states, so a
 * Retry does not open the dialog again. The visibility the learner chooses is
 * saved here, independently of title editing.
 */
function ChatSharingDialog({
  chat,
  open,
  onOpenChange,
}: {
  chat: ChatView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("Ai");
  const actionErrorMessage = useTranslations("Common")("action-error");
  const updateChatVisibility = useUpdateChatVisibilityMutation();
  // Each retry gives the footer a new key, which subscribes to the link afresh.
  const [attempt, setAttempt] = useState(0);
  /**
   * Persist the selected chat visibility. Choosing the visibility the chat
   * already has sends nothing.
   */
  const handleUpdateVisibility = (visibility: ChatVisibility) => {
    if (chat.visibility === visibility) {
      return;
    }
    Effect.runFork(
      Effect.asVoid(
        Effect.tryPromise(() =>
          updateChatVisibility({
            chatId: chat._id,
            visibility,
          })
        ).pipe(Effect.flatMap(Effect.fromResult))
      ).pipe(
        Effect.matchEffect({
          onSuccess: () => Effect.void,
          onFailure: (error) =>
            reportClientException(error, {
              source: "components/ai/chat/sharing",
            }).pipe(
              Effect.andThen(
                Effect.sync(() => {
                  toast.error(actionErrorMessage);
                })
              )
            ),
        })
      )
    );
  };

  return (
    <ResponsiveDialog
      description={t("share-chat-description")}
      footer={
        <ChatSharingAction
          chat={chat}
          key={attempt}
          onCreate={() => handleUpdateVisibility("public")}
          onRetry={() => setAttempt((count) => count + 1)}
        />
      }
      open={open}
      setOpen={onOpenChange}
      title={t("share-chat")}
    >
      <div className="flex flex-col divide-y overflow-hidden rounded-lg border">
        {Arr.map(["public", "private"] as const, (visibility) => {
          const isSelected = visibility === chat.visibility;
          const isPublic = visibility === "public";
          return (
            <button
              className="group flex cursor-pointer items-start gap-4 bg-card p-4 text-card-foreground transition-colors ease-out hover:bg-accent hover:text-accent-foreground"
              key={visibility}
              onClick={() => handleUpdateVisibility(visibility)}
              type="button"
            >
              <div className="flex flex-1 flex-col items-start justify-start gap-1">
                <div className="flex items-center gap-2">
                  <HugeIcons
                    className="size-4 shrink-0"
                    icon={isPublic ? Globe02Icon : SquareLock01Icon}
                  />
                  <span className="text-sm">{t(visibility)}</span>
                </div>
                <p className="text-start text-muted-foreground text-sm group-hover:text-accent-foreground">
                  {t(`${visibility}-description`)}
                </p>
              </div>

              <HugeIcons
                className={cn(
                  "size-4 shrink-0 text-primary opacity-0 transition-opacity ease-out group-hover:text-accent-foreground",
                  !!isSelected && "opacity-100"
                )}
                icon={Tick01Icon}
              />
            </button>
          );
        })}
      </div>
    </ResponsiveDialog>
  );
}

/**
 * The one action of the share dialog and the token it needs. A private chat
 * creates its link. A shared chat copies the link once the server has drawn its
 * token. A token the server could not read is said in the footer, beside Retry.
 * The token is read here, so the dialog reads it while it is open.
 */
function ChatSharingAction({
  chat,
  onCreate,
  onRetry,
}: {
  chat: ChatView;
  onCreate: () => void;
  onRetry: () => void;
}) {
  const t = useTranslations("Ai");
  const clipboard = useClipboard({ timeout: 500 });
  const isPrivate = chat.visibility === "private";
  const tokenResult = useQuery(
    chats.queries.getShareToken,
    isPrivate ? "skip" : { chatId: chat._id }
  );

  if (QueryResult.isFailure(tokenResult)) {
    return (
      <div className="flex w-full items-center justify-between gap-4">
        <p className="text-muted-foreground text-sm">{t("share-link-error")}</p>
        <Button onClick={onRetry}>
          <HugeIcons icon={Refresh03Icon} />
          {t("retry")}
        </Button>
      </div>
    );
  }

  if (isPrivate) {
    return (
      <Button onClick={onCreate}>
        <HugeIcons icon={Link04Icon} />
        {t("create-link")}
      </Button>
    );
  }

  const token = QueryResult.isSuccess(tokenResult) ? tokenResult.value : null;
  /** Copy the link once the server has drawn its token. */
  const handleCopy = () => {
    if (token === null) {
      return;
    }
    clipboard.copy(shareLink(chat._id, token));
    toast.success(t("link-copied"), {
      position: "bottom-center",
    });
  };

  return (
    <Button disabled={token === null} onClick={handleCopy}>
      <HugeIcons icon={clipboard.copied ? Tick01Icon : Copy01Icon} />
      {t("copy-link")}
    </Button>
  );
}
