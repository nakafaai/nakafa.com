"use client";

import { useClipboard } from "@mantine/hooks";
import { Action, Actions } from "@repo/design-system/components/ai/actions";
import { CheckIcon, CopyIcon, RefreshCcwIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { memo } from "react";
import { useChat } from "@/lib/context/use-chat";

type Props = {
  messageId: string;
  text: string;
  showActions?: boolean;
};

export const FinanceChatMessageActions = memo(
  ({ messageId, text, showActions = true }: Props) => {
    const t = useTranslations("Ai");

    const regenerate = useChat((state) => state.chat.regenerate);
    const status = useChat((state) => state.chat.status);

    const clipboard = useClipboard({ timeout: 1000 });

    const disabled = status === "submitted" || status === "streaming";

    if (!showActions) {
      return null;
    }

    return (
      <Actions className="transition-opacity ease-out group-hover:opacity-100 lg:opacity-0">
        <Action
          disabled={disabled}
          label={t("retry-message")}
          onClick={() => regenerate({ messageId })}
          tooltip={t("retry-message")}
        >
          <RefreshCcwIcon />
        </Action>
        <Action
          label={t("copy-message")}
          onClick={() => clipboard.copy(text)}
          tooltip={t("copy-message")}
        >
          {clipboard.copied ? <CheckIcon /> : <CopyIcon />}
        </Action>
      </Actions>
    );
  }
);
FinanceChatMessageActions.displayName = "FinanceChatMessageActions";
