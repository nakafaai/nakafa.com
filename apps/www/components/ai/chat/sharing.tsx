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
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { shareLink } from "@/components/ai/chat/link";
import { useUpdateChatVisibilityMutation } from "@/components/ai/chat/mutation.client";
import { reportClientException } from "@/lib/analytics/client";
import { isNewLinkFailure } from "@/lib/share/failure";

/**
 * The share dialog of one chat. The dialog mounts once and stays in place while
 * its description and its action change between the warning, the link and the
 * link error, so a retry or an answer never replays its enter animation. A link
 * the server could not load shows in the dialog, which offers to load it again,
 * and never takes the chat page with it.
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
  const t = useTranslations("Ai");
  const actionErrorMessage = useTranslations("Common")("action-error");
  const updateChatVisibility = useUpdateChatVisibilityMutation();
  // A retry gives the two readers of the link a new key. Each one subscribes to
  // the token again, which asks the server anew, while the dialog stays mounted.
  const [attempt, setAttempt] = useState(0);
  const isPrivate = chat.visibility === "private";
  const retry = () => setAttempt((count) => count + 1);

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

  return (
    <ResponsiveDialog
      description={
        <ErrorBoundary
          fallbackRender={() => t("share-link-error")}
          key={attempt}
        >
          <ChatShareDescription chatId={chat._id} isPrivate={isPrivate} />
        </ErrorBoundary>
      }
      footer={
        // The description's boundary reports an undeclared failure of the read
        // that both of them make, so this boundary recovers it without a report.
        <ErrorBoundary
          fallbackRender={() => <ChatShareRetry onRetry={retry} />}
          key={attempt}
          report={false}
        >
          <ChatShareAction
            chatId={chat._id}
            isPrivate={isPrivate}
            onCreate={() => handleUpdateVisibility("public")}
            onRetry={retry}
          />
        </ErrorBoundary>
      }
      open={open}
      setOpen={onOpenChange}
      title={t("share-chat")}
    >
      <div className="flex flex-col divide-y">
        {Arr.map(["public", "private"] as const, (visibility) => {
          const isSelected = visibility === chat.visibility;
          const isPublic = visibility === "public";
          return (
            <button
              className="group flex cursor-pointer items-start gap-4 p-4 transition-colors ease-out hover:bg-accent hover:text-accent-foreground"
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
 * Reads the share token of a chat that is public. A private chat has no token
 * to read, so its query is skipped.
 */
function useChatShareToken(chatId: ChatView["_id"], isPrivate: boolean) {
  return useQuery(chats.queries.getShareToken, isPrivate ? "skip" : { chatId });
}

/** The tag of the failure that one read of the link shows, or null when it did not fail. */
function linkFailure(link: ReturnType<typeof useChatShareToken>) {
  return QueryResult.isFailure(link) ? link.error._tag : null;
}

/**
 * The description of the share dialog: the warning, or the link error while the
 * server cannot load the link. A declared failure returns here and never throws.
 */
function ChatShareDescription({
  chatId,
  isPrivate,
}: {
  chatId: ChatView["_id"];
  isPrivate: boolean;
}) {
  const t = useTranslations("Ai");
  const link = useChatShareToken(chatId, isPrivate);
  if (QueryResult.isFailure(link)) {
    return t("share-link-error");
  }
  return t("share-chat-description");
}

/**
 * The action of the share dialog: create the link, copy it, or load it again.
 * A declared failure shows inline and never reaches the error boundary. Convex
 * keeps a failed answer until the server answers again after its last subscriber
 * leaves, and a render that throws that answer never subscribes again, so a retry
 * that threw it would find the same error. The action reports a failure that
 * appears while it is mounted. A retry mounts it afresh, and the failure that the
 * cache still holds then is not new, so it is not reported again.
 */
function ChatShareAction({
  chatId,
  isPrivate,
  onCreate,
  onRetry,
}: {
  chatId: ChatView["_id"];
  isPrivate: boolean;
  onCreate: () => void;
  onRetry: () => void;
}) {
  const t = useTranslations("Ai");
  const clipboard = useClipboard({ timeout: 500 });
  const link = useChatShareToken(chatId, isPrivate);
  const failure = linkFailure(link);
  // The failure at the mount is the cache's answer, which a retry shows until the
  // server answers, so only a failure that appears after the mount is reported.
  const seenFailure = useRef(failure);
  useEffect(() => {
    if (
      isNewLinkFailure(seenFailure.current, failure) &&
      QueryResult.isFailure(link)
    ) {
      Effect.runFork(
        reportClientException(link.error, {
          source: "components/ai/chat/sharing",
        })
      );
    }
    seenFailure.current = failure;
  }, [failure, link]);

  if (isPrivate) {
    return (
      <Button onClick={onCreate}>
        <HugeIcons icon={Link04Icon} />
        {t("create-link")}
      </Button>
    );
  }
  if (QueryResult.isFailure(link)) {
    return <ChatShareRetry onRetry={onRetry} />;
  }
  const token = QueryResult.isSuccess(link) ? link.value : null;
  /** Copy the link once the server has drawn its token. */
  const handleCopy = () => {
    if (token === null) {
      return;
    }
    clipboard.copy(shareLink(chatId, token));
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

/** Asks the server for the link again, in place of the link action. */
function ChatShareRetry({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("Ai");

  return (
    <Button onClick={onRetry}>
      <HugeIcons icon={Refresh03Icon} />
      {t("retry")}
    </Button>
  );
}
