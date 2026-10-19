"use client";

import { Alert02Icon } from "@hugeicons/core-free-icons";
import {
  Alert,
  AlertDescription,
} from "@repo/design-system/components/ui/alert";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { MessageScrollerItem } from "@repo/design-system/components/ui/scroller";
import { useTranslations } from "use-intl";
import { readStopFailure } from "@/components/ai/chat/cancel";
import { useChat } from "@/components/ai/chat/context";
import { useChatStore } from "@/components/ai/chat/store.client";
import {
  ninaFailureFeedback,
  ninaFailureLimits,
  ninaResponseFeedback,
} from "@/components/ai/feedback";
import { useMessage } from "@/components/ai/message/context";
import { useCurrentAuthNavigation } from "@/lib/auth/location.client";

/** Read the turn attached to this message, including older failed responses. */
export function AiChatPersistedError() {
  const t = useTranslations("Ai");
  const state = useMessage((value) => value.turn?.state);
  const reason =
    state?.status === "failed" ? (state.reason ?? "unknown") : "unknown";
  return (
    <Alert variant="destructive">
      <HugeIcons icon={Alert02Icon} />
      <AlertDescription>
        {t(`failures.${ninaResponseFeedback[reason].message}`)}
      </AlertDescription>
    </Alert>
  );
}

/**
 * The title and the description of a send failure: the copy of its toast, so
 * the sentence the learner reads in the chat is the one the toast shows.
 */
function ToastCopyText({
  message,
}: {
  message: (typeof ninaFailureFeedback)[keyof typeof ninaFailureFeedback]["message"];
}) {
  const tToast = useTranslations("Toast");
  return (
    <>
      <p className="font-medium">
        {tToast(`failure-${message}.title`, ninaFailureLimits)}
      </p>
      <p>{tToast(`failure-${message}.description`, ninaFailureLimits)}</p>
    </>
  );
}

/**
 * The way out of a failure that the learner can take: retry it, review credits,
 * sign in again, or start a new chat. Retry needs a chat the learner can write to.
 */
function FailureActions({
  action,
  canWrite,
  disabled,
  retry,
}: {
  action: string;
  canWrite: boolean;
  disabled: boolean;
  retry: () => void;
}) {
  const t = useTranslations("Ai");
  const authNavigation = useCurrentAuthNavigation();
  return (
    <>
      {canWrite && action === "retry" ? (
        <Button
          disabled={disabled}
          onClick={() => retry()}
          size="sm"
          variant="outline"
        >
          {t("retry")}
        </Button>
      ) : null}
      {action === "credits" ? (
        <Button
          nativeButton={false}
          render={<NavigationLink href="/user/settings/subscriptions" />}
          size="sm"
          variant="outline"
        >
          {t("review-credits")}
        </Button>
      ) : null}
      {action === "sign-in" ? (
        <Button
          nativeButton={false}
          render={<NavigationLink {...authNavigation.linkProps} />}
          size="sm"
          variant="outline"
        >
          {t("sign-in-again")}
        </Button>
      ) : null}
      {action === "new-chat" ? (
        <Button
          nativeButton={false}
          render={<NavigationLink href="/chat" />}
          size="sm"
          variant="outline"
        >
          {t("new-chat")}
        </Button>
      ) : null}
    </>
  );
}

/**
 * Admission failures and failed turns without an Agent assistant message.
 * The transcript says whether the failed turn already shows its own error.
 */
export function AiChatError({ failed }: { failed: boolean }) {
  const t = useTranslations("Ai");
  const submissionFailure = useChatStore((state) => state.submissionFailure);
  const stopFailure = useChatStore((state) => state.stopFailure);
  const turn = useChat((state) => state.turn);
  const error = submissionFailure ?? readStopFailure(stopFailure, turn);
  const retry = useChat((state) => state.retry);
  const canWrite = useChat((state) => state.canWrite);
  const busy = useChat((state) => state.busy);
  const isLoading = useChat((state) => state.isLoading);
  if (!error && (turn?.state.status !== "failed" || failed)) {
    return null;
  }
  // A send failure and a persisted response failure have their own tables, so
  // each message key is read only from the table that holds it.
  const admission = error ? ninaFailureFeedback[error.code] : null;
  const response =
    ninaResponseFeedback[
      turn?.state.status === "failed"
        ? (turn.state.reason ?? "unknown")
        : "unknown"
    ];
  const feedback = admission ?? response;
  return (
    <MessageScrollerItem messageId="failure">
      <Alert variant="destructive">
        <HugeIcons icon={Alert02Icon} />
        <AlertDescription>
          {/* A failed send shows the same title and description as its toast, one owner of the copy. */}
          {admission ? (
            <ToastCopyText message={admission.message} />
          ) : (
            <p>{t(`failures.${response.message}`)}</p>
          )}
          <FailureActions
            action={feedback.action}
            canWrite={canWrite}
            disabled={busy || isLoading}
            retry={retry}
          />
        </AlertDescription>
      </Alert>
    </MessageScrollerItem>
  );
}
