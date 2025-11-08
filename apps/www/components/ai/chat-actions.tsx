"use client";

import { useClipboard } from "@mantine/hooks";
import {
  MessageAction,
  MessageActions,
} from "@repo/design-system/components/ai/message";
import { CheckIcon, CopyIcon, RefreshCcwIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { memo } from "react";
import { useChat } from "@/lib/context/use-chat";

type Props = {
  messageId: string;
  text: string;
  showActions?: boolean;
};

export const AIChatMessageActions = memo(
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
      <MessageActions className="transition-opacity ease-out group-hover:opacity-100 lg:opacity-0">
        <MessageAction
          disabled={disabled}
          label={t("retry-message")}
          onClick={() => regenerate({ messageId })}
          tooltip={t("retry-message")}
        >
          <RefreshCcwIcon />
        </MessageAction>
        <MessageAction
          label={t("copy-message")}
          onClick={() => clipboard.copy(text)}
          tooltip={t("copy-message")}
        >
          {clipboard.copied ? <CheckIcon /> : <CopyIcon />}
        </MessageAction>
      </MessageActions>
    );
  }
);
AIChatMessageActions.displayName = "AIChatMessageActions";
