import {
  ArrowTurnBackwardIcon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useTranslations } from "next-intl";
import { memo } from "react";
import { useForumSession } from "@/components/school/classes/forum/context/use-session";
import { useData } from "@/components/school/classes/forum/conversation/context/use-data";

/** Renders the active reply target bar above the forum input. */
export const ReplyIndicator = memo(() => {
  const t = useTranslations("Common");
  const forumId = useData((state) => state.forumId);
  const replyTarget = useForumSession(
    (state) => state.replyTargetByForumId[forumId] ?? null
  );
  const setForumReplyTarget = useForumSession(
    (state) => state.setForumReplyTarget
  );

  if (!replyTarget) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 overflow-hidden rounded-t-md border-x border-t bg-[color-mix(in_oklch,var(--secondary)_10%,var(--background))] px-3 py-2 text-sm">
      <HugeIcons
        className="size-4 text-muted-foreground"
        icon={ArrowTurnBackwardIcon}
      />
      <p className="min-w-0 flex-1 truncate text-muted-foreground">
        {t.rich("replying-to-user", {
          name: () => (
            <span className="font-medium text-primary">
              {replyTarget.userName}
            </span>
          ),
        })}
      </p>
      <Button
        onClick={() => setForumReplyTarget(forumId, null)}
        size="icon-xs"
        type="button"
        variant="ghost"
      >
        <span className="sr-only">{t("cancel")}</span>
        <HugeIcons icon={Cancel01Icon} />
      </Button>
    </div>
  );
});
ReplyIndicator.displayName = "ReplyIndicator";
