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
};

export const AIChatMessageActions = memo(({ messageId, text }: Props) => {
  const t = useTranslations("Ai");

  const regenerate = useChat((state) => state.chat.regenerate);

  const clipboard = useClipboard({ timeout: 1000 });

  return (
    <Actions className="opacity-0 transition-opacity ease-out group-hover:opacity-100">
      <Action
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
});
AIChatMessageActions.displayName = "AIChatMessageActions";
