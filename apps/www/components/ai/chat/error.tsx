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
import { useTranslations } from "next-intl";
import { useChat } from "@/components/ai/chat/context";
import {
  ninaFailureFeedback,
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

/** Admission failures and failed turns without an Agent assistant message. */
export function AiChatError() {
  const t = useTranslations("Ai");
  const authNavigation = useCurrentAuthNavigation();
  const error = useChat((state) => state.error);
  const turn = useChat((state) => state.turn);
  const messages = useChat((state) => state.messages);
  const retry = useChat((state) => state.retry);
  const canWrite = useChat((state) => state.canWrite);
  const busy = useChat((state) => state.busy);
  const hasInlineFailure = messages.some(
    (message) =>
      message.role === "assistant" &&
      message.order === turn?.order &&
      message.status === "failed"
  );
  if (!error && (turn?.state.status !== "failed" || hasInlineFailure)) {
    return null;
  }
  const feedback = error
    ? ninaFailureFeedback[error.code]
    : ninaResponseFeedback[
        turn?.state.status === "failed"
          ? (turn.state.reason ?? "unknown")
          : "unknown"
      ];
  return (
    <MessageScrollerItem messageId="failure">
      <Alert variant="destructive">
        <HugeIcons icon={Alert02Icon} />
        <AlertDescription>
          <p>{t(`failures.${feedback.message}`)}</p>
          {!error && canWrite && feedback.action === "retry" ? (
            <Button
              disabled={busy}
              onClick={() => retry()}
              size="sm"
              variant="outline"
            >
              {t("retry")}
            </Button>
          ) : null}
          {feedback.action === "credits" ? (
            <Button
              nativeButton={false}
              render={<NavigationLink href="/user/settings/subscriptions" />}
              size="sm"
              variant="outline"
            >
              {t("review-credits")}
            </Button>
          ) : null}
          {feedback.action === "sign-in" ? (
            <Button
              nativeButton={false}
              render={<NavigationLink {...authNavigation.linkProps} />}
              size="sm"
              variant="outline"
            >
              {t("sign-in-again")}
            </Button>
          ) : null}
          {feedback.action === "new-chat" ? (
            <Button
              nativeButton={false}
              render={<NavigationLink href="/chat" />}
              size="sm"
              variant="outline"
            >
              {t("new-chat")}
            </Button>
          ) : null}
        </AlertDescription>
      </Alert>
    </MessageScrollerItem>
  );
}
