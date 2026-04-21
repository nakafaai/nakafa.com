import { api } from "@repo/backend/convex/_generated/api";
import { Button } from "@repo/design-system/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@repo/design-system/components/ui/hover-card";
import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { memo, useTransition } from "react";
import type { ForumPost } from "@/components/school/classes/forum/conversation/models";

/** Renders the current reaction chips and toggles for one post. */
export const PostReactions = memo(({ post }: { post: ForumPost }) => {
  const t = useTranslations("Common");
  const [isPending, startTransition] = useTransition();
  const toggleReaction = useMutation(
    api.classes.forums.mutations.reactions.togglePostReaction
  );

  if (post.reactionUsers.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {post.reactionUsers.map(({ emoji, count, reactors }) => {
        const isMyReaction = post.myReactions.includes(emoji);
        const moreCount = count - reactors.length;

        return (
          <HoverCard key={emoji}>
            <HoverCardTrigger asChild>
              <Button
                disabled={isPending}
                onClick={() => {
                  startTransition(async () => {
                    await toggleReaction({ postId: post._id, emoji });
                  });
                }}
                size="sm"
                variant={isMyReaction === true ? "default-outline" : "outline"}
              >
                {emoji}
                <span className="tracking-tight">{count}</span>
              </Button>
            </HoverCardTrigger>
            <HoverCardContent
              align="center"
              className="w-auto max-w-64"
              side="top"
            >
              <div className="flex items-center gap-2">
                <span className="text-3xl">{emoji}</span>
                <p className="line-clamp-2 text-sm leading-tight">
                  {moreCount > 0
                    ? t("reacted-by-more", {
                        names: reactors.join(", "),
                        count: moreCount,
                      })
                    : t("reacted-by", { names: reactors.join(", ") })}
                </p>
              </div>
            </HoverCardContent>
          </HoverCard>
        );
      })}
    </div>
  );
});
PostReactions.displayName = "PostReactions";
