"use client";

import {
  Copy01Icon,
  Refresh03Icon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";
import { useClipboard } from "@mantine/hooks";
import { Action, Actions } from "@repo/design-system/components/ai/actions";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cn } from "@repo/design-system/lib/utils";
import { useTranslations } from "next-intl";
import { memo } from "react";
import { useChat } from "@/components/ai/context/use-chat";
import { useCurrentChat } from "@/components/ai/context/use-current-chat";
import { useMessage } from "@/components/ai/context/use-message";
import { useUser } from "@/lib/context/use-user";

export const AiChatMessageActions = memo(() => {
  const t = useTranslations("Ai");

  const messageId = useMessage((state) => state.message.id);
  const role = useMessage((state) => state.message.role);
  const text = useMessage((state) =>
    state.message.parts
      .filter((p) => p.type === "text")
      .map((p) => p.text)
      .join("\n")
  );

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
    <Actions className={cn(role === "assistant" && "my-6")}>
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
AiChatMessageActions.displayName = "AiChatMessageActions";
