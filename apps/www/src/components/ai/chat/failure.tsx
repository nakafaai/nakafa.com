import { Button } from "@repo/design-system/components/ui/button";
import { useTranslations } from "use-intl";
import { useChatRetry } from "@/components/ai/chat/recovery";
import { Unauthenticated } from "@/components/auth/gate";
import { AuthGoogle } from "@/components/auth/google";
import { EmptyState } from "@/components/state/empty";
import { EmptyNina } from "@/components/state/nina";

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
      <EmptyState
        action={
          <Unauthenticated>
            <AuthGoogle />
          </Unauthenticated>
        }
        description={t("chat-unavailable")}
        scene={<EmptyNina act="guarding" />}
        title={t("private-chat-error")}
      />
    );
  }

  return (
    <EmptyState
      action={<ChatRetryButton />}
      description={t("chat-failed-description")}
      scene={<EmptyNina act="typing" />}
      title={t("chat-failed")}
    />
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
