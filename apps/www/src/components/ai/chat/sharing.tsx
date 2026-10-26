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
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { toast } from "@repo/design-system/lib/toast/notify";
import { cn } from "cn";
import { Array as Arr, Effect } from "effect";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "use-intl";
import { shareLink } from "@/components/ai/chat/link";
import { useUpdateChatVisibilityMutation } from "@/components/ai/chat/mutation";
import { ChatRetryContext, useChatRetry } from "@/components/ai/chat/recovery";
import { reportClientException } from "@/lib/analytics/client";
import { useAnswerRetry } from "@/lib/convex/requery";
import { useCurrentLocale } from "@/lib/routing/link";
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
  warmed,
}: {
  chat: ChatView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Whether the reader has shown intent on the item that shares the chat. */
  warmed: boolean;
}) {
  const t = useTranslations("Ai");
  const updateChatVisibility = useUpdateChatVisibilityMutation();
  // A retry gives the readers of the link a new key, and the dialog stays
  // mounted. Each reader subscribes to the token once it mounts.
  const [attempt, setAttempt] = useState(0);
  const remount = () => setAttempt((count) => count + 1);
  const { retry, waiting } = useAnswerRetry(
    chats.queries.getShareToken,
    { chatId: chat._id },
    remount
  );
  const isPrivate = chat.visibility === "private";

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
                  toast.error({
                    description: "action-error.description",
                    title: "action-error.title",
                  });
                })
              )
            ),
        })
      )
    );
  };

  return (
    <>
      {/* The link is read once the reader shows intent on the share item, so the dialog's first frame
      already has its copy action enabled, or the link's error, and not a copy action that waits.
      The warm read lets go while the dialog is open: the dialog's readers then hold the link alone,
      so a retry asks the server, as it does without the warm read. */}
      <ErrorBoundary fallback={null} key={chat._id} report={false}>
        <ChatShareWarm chatId={chat._id} skip={isPrivate || !warmed || open} />
      </ErrorBoundary>
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
            fallbackRender={() => (
              <ChatRetryContext value={{ isPending: waiting, onRetry: retry }}>
                <ChatShareRetry />
              </ChatRetryContext>
            )}
            key={attempt}
            report={false}
          >
            <ChatRetryContext value={{ isPending: false, onRetry: remount }}>
              <ChatShareAction
                chatId={chat._id}
                isPrivate={isPrivate}
                onCreate={() => handleUpdateVisibility("public")}
              />
            </ChatRetryContext>
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
    </>
  );
}

/**
 * Reads the share token of a chat that is public. A private chat has no token
 * to read, so its query is skipped, and so is a read that waits for intent.
 */
function useChatShareToken(chatId: ChatView["_id"], skip: boolean) {
  return useQuery(chats.queries.getShareToken, skip ? "skip" : { chatId });
}

/** Holds the share token's read while the dialog is closed, so the dialog opens with it. */
function ChatShareWarm({
  chatId,
  skip,
}: {
  chatId: ChatView["_id"];
  skip: boolean;
}) {
  useChatShareToken(chatId, skip);
  return null;
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
 * A declared failure shows inline and never reaches the error boundary: its
 * readers stay subscribed, so a retry remounts them and the server answers anew.
 * An undeclared failure unmounts the readers instead, and its retry waits for the
 * server's answer first (see `useAnswerRetry`). The action reports a failure that
 * appears while it is mounted. A retry mounts it afresh, and the failure that the
 * cache still holds then is not new, so it is not reported again.
 */
function ChatShareAction({
  chatId,
  isPrivate,
  onCreate,
}: {
  chatId: ChatView["_id"];
  isPrivate: boolean;
  onCreate: () => void;
}) {
  const t = useTranslations("Ai");
  const clipboard = useClipboard({ timeout: 500 });
  const locale = useCurrentLocale();
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
    return <ChatShareRetry />;
  }
  const token = QueryResult.isSuccess(link) ? link.value : null;
  /** Copy the link once the server has drawn its token. */
  const handleCopy = () => {
    if (token === null) {
      return;
    }
    clipboard.copy(shareLink(chatId, token, locale));
    toast.success(
      { title: "link-copied.title" },
      { position: "bottom-center" }
    );
  };

  return (
    <Button disabled={token === null} onClick={handleCopy}>
      <HugeIcons icon={clipboard.copied ? Tick01Icon : Copy01Icon} />
      {t("copy-link")}
    </Button>
  );
}

/**
 * Asks the server for the link again, in place of the link action. While a retry
 * waits for the server's answer, the button is disabled and shows the spinner of
 * the design system.
 */
function ChatShareRetry() {
  const t = useTranslations("Ai");
  const { isPending, onRetry } = useChatRetry();

  return (
    <Button
      aria-busy={isPending || undefined}
      disabled={isPending}
      onClick={onRetry}
    >
      <Spinner aria-hidden="true" icon={Refresh03Icon} isLoading={isPending} />
      {t("retry")}
    </Button>
  );
}
