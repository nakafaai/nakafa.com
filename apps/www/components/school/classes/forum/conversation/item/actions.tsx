import { ArrowTurnBackwardIcon, WinkIcon } from "@hugeicons/core-free-icons";
import { useDisclosure } from "@mantine/hooks";
import { captureException } from "@repo/analytics/posthog";
import { api } from "@repo/backend/convex/_generated/api";
import { Button } from "@repo/design-system/components/ui/button";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import {
  EmojiPicker,
  EmojiPickerContent,
  EmojiPickerFooter,
  EmojiPickerSearch,
} from "@repo/design-system/components/ui/emoji-picker";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { cn } from "@repo/design-system/lib/utils";
import { useMutation } from "convex/react";
import { Effect } from "effect";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { useForumSession } from "@/components/school/classes/forum/context/use-session";
import type { ForumPost } from "@/components/school/classes/forum/conversation/data/entities";

/**
 * Keeps post-level quick actions grouped together so reply and reaction updates
 * stay close to the post they mutate.
 */
export function PostItemActions({ post }: { post: ForumPost }) {
  const t = useTranslations("Common");
  const setForumReplyTarget = useForumSession(
    (state) => state.setForumReplyTarget
  );
  const [isReactionPickerOpen, reactionPicker] = useDisclosure(false);
  const [isPending, startTransition] = useTransition();
  const toggleReaction = useMutation(
    api.classes.forums.mutations.reactions.togglePostReaction
  );
  const userName = post.user?.name ?? t("anonymous");

  return (
    <ButtonGroup
      className={cn(
        "absolute -top-4 right-4 z-1 opacity-0 shadow-xs transition-opacity ease-out group-hover:opacity-100",
        isReactionPickerOpen && "opacity-100"
      )}
    >
      <Popover
        onOpenChange={(open) => {
          if (open) {
            reactionPicker.open();
            return;
          }

          reactionPicker.close();
        }}
        open={isReactionPickerOpen}
      >
        <Tooltip>
          <TooltipTrigger
            render={
              <PopoverTrigger
                render={
                  <Button disabled={isPending} size="icon" variant="outline" />
                }
              >
                <HugeIcons icon={WinkIcon} />
                <span className="sr-only">{t("reaction")}</span>
              </PopoverTrigger>
            }
          />
          <TooltipContent side="top">{t("reaction")}</TooltipContent>
        </Tooltip>
        <PopoverContent align="end" className="w-fit p-0">
          <EmojiPicker
            className="h-80"
            onEmojiSelect={({ emoji }) => {
              startTransition(() =>
                Effect.runPromise(
                  Effect.tryPromise({
                    try: () => toggleReaction({ postId: post._id, emoji }),
                    catch: (cause) => cause,
                  }).pipe(
                    Effect.asVoid,
                    Effect.catchAll((cause) =>
                      Effect.sync(() => {
                        captureException(cause, {
                          source: "post-reaction-picker",
                        });
                      })
                    )
                  )
                )
              );
              reactionPicker.close();
            }}
          >
            <EmojiPickerSearch />
            <EmojiPickerContent />
            <EmojiPickerFooter />
          </EmojiPicker>
        </PopoverContent>
      </Popover>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              onClick={() =>
                setForumReplyTarget(post.forumId, {
                  postId: post._id,
                  userName,
                })
              }
              size="icon"
              variant="outline"
            >
              <HugeIcons icon={ArrowTurnBackwardIcon} />
              <span className="sr-only">{t("reply")}</span>
            </Button>
          }
        />
        <TooltipContent side="top">{t("reply")}</TooltipContent>
      </Tooltip>
    </ButtonGroup>
  );
}
