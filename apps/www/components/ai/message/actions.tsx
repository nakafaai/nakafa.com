"use client";

import {
  Copy01Icon,
  Refresh03Icon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";
import { useClipboard } from "@mantine/hooks";
import { Action, Actions } from "@repo/design-system/components/ai/actions";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Array as Arr } from "effect";
import { useTranslations } from "next-intl";

import { useChat } from "@/components/ai/chat/context";
import { ninaResponseFeedback } from "@/components/ai/feedback";
import { useMessage } from "@/components/ai/message/context";
import { AiChatMessageRemembered } from "@/components/ai/message/remembered";
import { useViewer } from "@/lib/identity/client";

export function AiChatMessageActions() {
  const t = useTranslations("Ai");

  const order = useMessage((state) => state.message.order);
  const canRetry = useMessage(
    ({ message, turn }) =>
      message.role !== "assistant" ||
      turn?.state.status !== "failed" ||
      ninaResponseFeedback[turn.state.reason ?? "unknown"].action === "retry"
  );
  const text = useMessage((state) =>
    Arr.join(
      Arr.flatMap(state.message.parts, (part) =>
        part.type === "text" ? [part.text] : []
      ),
      "\n"
    )
  );
  const hasText = text.trim().length > 0;

  const retry = useChat((state) => state.retry);
  const busy = useChat((state) => state.busy);

  const chat = useChat((s) => s.chat);

  const currentUser = useViewer((s) => s.account);
  const showActions = chat?.userId === currentUser?.appUser._id;

  const clipboard = useClipboard({ timeout: 1000 });

  const disabled = busy;

  if (!showActions) {
    return null;
  }

  return (
    <div className="flex min-w-0 items-center gap-3">
      <Actions>
        {canRetry ? (
          <Action
            disabled={disabled}
            label={t("retry-message")}
            onClick={() => retry(order)}
            tooltip={t("retry-message")}
          >
            <HugeIcons icon={Refresh03Icon} />
          </Action>
        ) : null}
        {hasText ? (
          <Action
            label={t("copy-message")}
            onClick={() => clipboard.copy(text)}
            tooltip={t("copy-message")}
          >
            <HugeIcons icon={clipboard.copied ? Tick01Icon : Copy01Icon} />
          </Action>
        ) : null}
      </Actions>
      <AiChatMessageRemembered />
    </div>
  );
}
AiChatMessageActions.displayName = "AiChatMessageActions";
