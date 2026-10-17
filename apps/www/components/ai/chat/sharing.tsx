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
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { shareLink } from "@/components/ai/chat/link";
import { useUpdateChatVisibilityMutation } from "@/components/ai/chat/mutation.client";
import { reportClientException } from "@/lib/analytics/client";

/**
 * The share dialog of one chat. A link the server could not load shows in the
 * dialog, which offers to load it again, and never takes the chat page with it.
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
  // Each retry gives the dialog a new key, which mounts its query afresh.
  const [attempt, setAttempt] = useState(0);

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
      <ChatSharingDialog
        chat={chat}
        key={attempt}
        onOpenChange={onOpenChange}
        onRetry={() => setAttempt((count) => count + 1)}
        open={open}
      />
    </ErrorBoundary>
  );
}

/**
 * The share dialog while the link could not be loaded. It says so in one
 * sentence and offers to load the link again, which asks the server anew.
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
 * Owns sharing state and visibility admission independently of title editing.
 * The link carries a token the server draws when the chat is shared, so the
 * link can be copied once the token arrives. A token the server fails to read
 * shows the link error, and Retry mounts this dialog afresh to ask again.
 *
 * The server declares the failures of the token read, and the dialog returns
 * each one rather than throwing it. Convex keeps a failed answer until the
 * server answers again after its last subscriber leaves, and a render that
 * throws that answer never subscribes again, so a retry that threw it would
 * find the same error.
 */
function ChatSharingDialog({
  chat,
  open,
  onOpenChange,
  onRetry,
}: {
  chat: ChatView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRetry: () => void;
}) {
  const t = useTranslations("Ai");
  const actionErrorMessage = useTranslations("Common")("action-error");
  const clipboard = useClipboard({ timeout: 500 });
  const updateChatVisibility = useUpdateChatVisibilityMutation();
  const isPrivate = chat.visibility === "private";
  const tokenResult = useQuery(
    chats.queries.getShareToken,
    isPrivate ? "skip" : { chatId: chat._id }
  );
  // A declared failure shows inline and never reaches the error boundary, which
  // would have reported it, so the dialog reports each answer that carries one.
  useEffect(() => {
    if (QueryResult.isFailure(tokenResult)) {
      Effect.runFork(
        reportClientException(tokenResult.error, {
          source: "components/ai/chat/sharing",
        })
      );
    }
  }, [tokenResult]);
  if (QueryResult.isFailure(tokenResult)) {
    return (
      <ChatSharingError
        onOpenChange={onOpenChange}
        onRetry={onRetry}
        open={open}
      />
    );
  }
  const token = QueryResult.isSuccess(tokenResult) ? tokenResult.value : null;
  /** Persist the selected chat visibility, unless the chat already has it. */
  const handleUpdateVisibility = (visibility: ChatVisibility) => {
    if (visibility === chat.visibility) {
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
    <ResponsiveDialog
      description={t("share-chat-description")}
      footer={
        isPrivate ? (
          <Button onClick={() => handleUpdateVisibility("public")}>
            <HugeIcons icon={Link04Icon} />
            {t("create-link")}
          </Button>
        ) : (
          <Button disabled={token === null} onClick={handleCopy}>
            <HugeIcons icon={clipboard.copied ? Tick01Icon : Copy01Icon} />
            {t("copy-link")}
          </Button>
        )
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
