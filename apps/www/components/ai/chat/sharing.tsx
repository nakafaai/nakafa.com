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
import { toast } from "@repo/design-system/lib/toast/notify";
import { cn } from "cn";
import { useConvex } from "convex/react";
import { Array as Arr, Effect, Exit, Scope } from "effect";
import { useTranslations } from "next-intl";
import {
  type RefObject,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { shareLink } from "@/components/ai/chat/link";
import { useUpdateChatVisibilityMutation } from "@/components/ai/chat/mutation.client";
import { reportClientException } from "@/lib/analytics/client";
import { awaitServerAnswer } from "@/lib/convex/answer";
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
  const convex = useConvex();
  const updateChatVisibility = useUpdateChatVisibilityMutation();
  // A retry gives the readers of the link a new key, and the dialog stays
  // mounted. Each reader subscribes to the token again once it mounts, which
  // asks the server anew.
  const [attempt, setAttempt] = useState(0);
  const [isPending, startTransition] = useTransition();
  // The subscription that holds a fresh answer for a retry, with the attempt the
  // retry started from. It ends once the attempt has moved on.
  const answerHold = useRef<{ attempt: number; scope: Scope.Closeable } | null>(
    null
  );
  const isPrivate = chat.visibility === "private";
  const remount = () => setAttempt((count) => count + 1);

  // Once the attempt has moved on, the readers of the new attempt have subscribed,
  // because the effects of children run before the effects of their parent.
  useEffect(() => {
    const hold = answerHold.current;
    if (hold !== null && hold.attempt !== attempt) {
      releaseAnswerHold(answerHold);
    }
  }, [attempt]);
  // A dialog that closes before the answer comes releases the answer it holds.
  useEffect(() => () => releaseAnswerHold(answerHold), []);

  /**
   * Retries a link that failed in a way the query does not declare. Its readers
   * have unmounted, so nothing subscribes to the token. The retry subscribes
   * first and waits for the server's answer, then remounts the readers, which
   * read that answer and subscribe. The button shows the pending state meanwhile.
   */
  const retryFromServer = () => {
    startTransition(async () => {
      const hold = Scope.makeUnsafe();
      answerHold.current = { attempt, scope: hold };
      await Effect.runPromise(
        awaitServerAnswer(convex, chats.queries.getShareToken, {
          chatId: chat._id,
        }).pipe(Scope.provide(hold))
      );
      // A nested transition keeps the remount in the same transition, so the
      // pending state lasts until the readers are back.
      startTransition(remount);
    });
  };

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
            <ChatShareRetry isPending={isPending} onRetry={retryFromServer} />
          )}
          key={attempt}
          report={false}
        >
          <ChatShareAction
            chatId={chat._id}
            isPrivate={isPrivate}
            onCreate={() => handleUpdateVisibility("public")}
            onRetry={remount}
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

/** Closes the subscription that a retry holds, if a retry holds one. */
function releaseAnswerHold(hold: RefObject<{ scope: Scope.Closeable } | null>) {
  const current = hold.current;
  if (current === null) {
    return;
  }
  hold.current = null;
  Effect.runFork(Scope.close(current.scope, Exit.void));
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
 * A declared failure shows inline and never reaches the error boundary: its
 * readers stay subscribed, so a retry remounts them and the server answers anew.
 * An undeclared failure unmounts the readers instead, and its retry asks the
 * server first (see `retryFromServer`). The action reports a failure that
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
 * Asks the server for the link again, in place of the link action. The button is
 * disabled while a retry waits for the server's answer.
 */
function ChatShareRetry({
  isPending = false,
  onRetry,
}: {
  isPending?: boolean;
  onRetry: () => void;
}) {
  const t = useTranslations("Ai");

  return (
    <Button
      aria-busy={isPending || undefined}
      disabled={isPending}
      onClick={onRetry}
    >
      <HugeIcons icon={Refresh03Icon} />
      {t("retry")}
    </Button>
  );
}
