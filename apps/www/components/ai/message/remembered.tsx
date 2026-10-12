"use client";

import { AiBrain01Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { IntentLink } from "@repo/design-system/components/ui/intent-link";
import { useTranslations } from "next-intl";
import { useMessage } from "@/components/ai/message/context";

/**
 * Tells the learner that Nina saved or confirmed a memory from the message
 * this answer replies to, and links to the Memory page where it can be read,
 * changed or deleted. An answer without one renders nothing.
 */
export function AiChatMessageRemembered() {
  const t = useTranslations("Ai");
  const remembered = useMessage(
    ({ message, turn }) =>
      message.role === "assistant" && turn?.remembered !== undefined
  );

  if (!remembered) {
    return null;
  }

  return (
    <IntentLink
      className="inline-flex items-center gap-1 rounded-md text-muted-foreground text-xs outline-none transition-colors ease-out hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      href="/user/settings/memory"
      title={t("remembered-title")}
    >
      <HugeIcons className="size-3.5" icon={AiBrain01Icon} />
      {t("remembered")}
    </IntentLink>
  );
}
AiChatMessageRemembered.displayName = "AiChatMessageRemembered";
