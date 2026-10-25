import { Button } from "@repo/design-system/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@repo/design-system/components/ui/empty";
import { useTranslations } from "use-intl";
import { Unauthenticated } from "@/components/auth/gate";
import { AuthGoogle } from "@/components/auth/google";
import { EmptyNina } from "@/components/state/empty";

/**
 * The props of a chat's failure card. A declared access failure needs no retry,
 * since no retry opens a chat the viewer may not read. Any other failure offers
 * one, which runs the read again.
 */
type ChatFailureProps =
  | { kind: "access" }
  | { isPending?: boolean; kind: "retry"; onRetry: () => void };

/**
 * The card a chat shows in place of its content when it cannot be read. A
 * declared access failure says the chat is not available to this viewer, and a
 * signed-out viewer can sign in. Any other failure says Nakafa could not load
 * the chat. While `isPending` is true, the retry button is disabled.
 */
export function ChatFailure(props: ChatFailureProps) {
  const t = useTranslations("Ai");

  if (props.kind === "access") {
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
        <Button
          disabled={props.isPending ?? false}
          onClick={props.onRetry}
          size="sm"
          variant="outline"
        >
          {t("retry")}
        </Button>
      </EmptyContent>
    </Empty>
  );
}
