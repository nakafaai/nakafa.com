import { Button } from "@repo/design-system/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@repo/design-system/components/ui/empty";
import { useTranslations } from "use-intl";
import { useChatRetry } from "@/components/ai/chat/retry";
import { Unauthenticated } from "@/components/auth/gate";
import { AuthGoogle } from "@/components/auth/google";
import { EmptyNina } from "@/components/state/empty";

/**
 * The card a chat shows in place of its content when it cannot be read. A
 * declared access failure says the chat is not available to this viewer, and a
 * signed-out viewer can sign in. Any other failure says Nakafa could not load
 * the chat, with the retry of the surface around it. A declared access failure
 * needs no retry, since no retry opens a chat the viewer may not read.
 */
export function ChatFailure({ kind }: { kind: "access" | "retry" }) {
  const t = useTranslations("Ai");

  if (kind === "access") {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyNina act="guarding" />
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
        <EmptyNina act="typing" />
        <EmptyTitle>{t("chat-failed")}</EmptyTitle>
        <EmptyDescription>{t("chat-failed-description")}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <ChatRetryButton />
      </EmptyContent>
    </Empty>
  );
}

/** The retry of a failed read, disabled while the retry around it waits. */
function ChatRetryButton() {
  const t = useTranslations("Ai");
  const { isPending, onRetry } = useChatRetry();

  return (
    <Button disabled={isPending} onClick={onRetry} size="sm" variant="outline">
      {t("retry")}
    </Button>
  );
}
