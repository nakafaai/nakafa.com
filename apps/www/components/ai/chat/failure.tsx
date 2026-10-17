"use client";

import { Alert02Icon, SquareLock01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@repo/design-system/components/ui/empty";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useTranslations } from "next-intl";
import { readChatFailureKind } from "@/components/ai/chat/access";
import { Unauthenticated } from "@/components/auth/gate";
import { AuthGoogle } from "@/components/auth/google";

/**
 * The card a chat shows in place of its content when it cannot be read. A
 * declared access failure says the chat is not available to this viewer, and a
 * signed-out viewer can sign in. Any other failure says Nakafa could not load
 * the chat, and retrying runs the read again.
 */
export function ChatFailure({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}) {
  const t = useTranslations("Ai");

  if (readChatFailureKind(error) === "access") {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HugeIcons icon={SquareLock01Icon} />
          </EmptyMedia>
          <EmptyTitle>{t("private-chat-error")}</EmptyTitle>
          <EmptyDescription>{t("chat-unavailable")}</EmptyDescription>
        </EmptyHeader>
        <Unauthenticated>
          <EmptyContent>
            <AuthGoogle />
          </EmptyContent>
        </Unauthenticated>
      </Empty>
    );
  }

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <HugeIcons icon={Alert02Icon} />
        </EmptyMedia>
        <EmptyTitle>{t("chat-failed")}</EmptyTitle>
        <EmptyDescription>{t("chat-failed-description")}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={onRetry} size="sm" variant="outline">
          {t("retry")}
        </Button>
      </EmptyContent>
    </Empty>
  );
}
