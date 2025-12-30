"use client";

import {
  Copy01Icon,
  Refresh03Icon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";
import { useClipboard } from "@mantine/hooks";
import { Action, Actions } from "@repo/design-system/components/ai/actions";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useTranslations } from "next-intl";
import { memo } from "react";
import { useChat } from "@/lib/context/use-chat";

interface Props {
  messageId: string;
  text: string;
  showActions?: boolean;
}

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
      <Actions className="transition-opacity ease-out group-hover:opacity-100 lg:opacity-0">
        <Action
          disabled={disabled}
          label={t("retry-message")}
          onClick={() => regenerate({ messageId })}
          tooltip={t("retry-message")}
        >
          <HugeIcons icon={Refresh03Icon} />
        </Action>
        <Action
          label={t("copy-message")}
          onClick={() => clipboard.copy(text)}
          tooltip={t("copy-message")}
        >
          <HugeIcons icon={clipboard.copied ? Tick01Icon : Copy01Icon} />
        </Action>
      </Actions>
    );
  }
);
AIChatMessageActions.displayName = "AIChatMessageActions";
