"use client";

import {
  Copy01Icon,
  Refresh03Icon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";
import { useClipboard } from "@mantine/hooks";
import type { MyUIMessage } from "@repo/ai/types/message";
import { Action, Actions } from "@repo/design-system/components/ai/actions";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cn } from "@repo/design-system/lib/utils";
import { useTranslations } from "next-intl";
import { memo } from "react";
import { useCurrentChat } from "@/components/ai/chat-provider";
import { useChat } from "@/lib/context/use-chat";
import { useUser } from "@/lib/context/use-user";

interface Props {
  messageId: string;
  role: MyUIMessage["role"];
  text: string;
}

export const AIChatMessageActions = memo(({ messageId, role, text }: Props) => {
  const t = useTranslations("Ai");

  const regenerate = useChat((state) => state.chat.regenerate);
  const status = useChat((state) => state.chat.status);

  const chat = useCurrentChat((s) => s.chat);

  const currentUser = useUser((s) => s.user);
  const showActions = chat?.userId === currentUser?.appUser._id;

  const clipboard = useClipboard({ timeout: 1000 });

  const disabled = status === "submitted" || status === "streaming";

  if (!showActions) {
    return null;
  }

  return (
    <Actions
      className={cn(role === "user" ? "translate-x-2" : "-translate-x-2.5")}
    >
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
});
AIChatMessageActions.displayName = "AIChatMessageActions";
