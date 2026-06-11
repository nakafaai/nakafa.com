import { api } from "@repo/backend/convex/_generated/api";
import { Button } from "@repo/design-system/components/ui/button";
import {
  PreviewCard,
  PreviewCardPopup,
  PreviewCardTrigger,
} from "@repo/design-system/components/ui/preview-card";
import { cn } from "@repo/design-system/lib/utils";
import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import type { ForumPost } from "@/components/school/classes/forum/conversation/data/entities";

/** Renders the current reaction chips and toggles for one post. */
export const PostReactions = ({ post }: { post: ForumPost }) => {
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
          <PreviewCard key={emoji}>
            <PreviewCardTrigger
              render={
                <Button
                  className={cn(
                    isMyReaction &&
                      "border-primary/40 bg-primary/8 text-primary hover:bg-primary/12"
                  )}
                  disabled={isPending}
                  onClick={() => {
                    startTransition(async () => {
                      await toggleReaction({ postId: post._id, emoji });
                    });
                  }}
                  size="sm"
                  variant="outline"
                />
              }
            >
              {emoji}
              <span className="tracking-tight">{count}</span>
            </PreviewCardTrigger>
            <PreviewCardPopup
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
            </PreviewCardPopup>
          </PreviewCard>
        );
      })}
    </div>
  );
};
PostReactions.displayName = "PostReactions";
