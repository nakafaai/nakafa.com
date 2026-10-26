import { Bookmark02Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useTranslations } from "use-intl";
import { useMessage } from "@/components/ai/message/context";
import { Link } from "@/lib/routing/link";

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
    <Link
      className="inline-flex items-center gap-1 rounded-md text-muted-foreground text-xs outline-none transition-colors ease-out hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      title={t("remembered-title")}
      to="/$locale/user/settings/memory"
    >
      <HugeIcons className="size-3.5" icon={Bookmark02Icon} />
      {t("remembered")}
    </Link>
  );
}
AiChatMessageRemembered.displayName = "AiChatMessageRemembered";
