import { ArrowTurnBackwardIcon, WinkIcon } from "@hugeicons/core-free-icons";
import { useDisclosure } from "@mantine/hooks";
import { api } from "@repo/backend/convex/_generated/api";
import {
  EmojiPicker,
  EmojiPickerContent,
  EmojiPickerFooter,
  EmojiPickerSearch,
} from "@repo/design-system/components/emoji/picker";
import { HugeIcons } from "@repo/design-system/components/icons/huge-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { Group } from "@repo/design-system/components/ui/group";
import {
  Popover,
  PopoverPopup,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import {
  Tooltip,
  TooltipPopup,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { cn } from "@repo/design-system/lib/utils";
import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { useForumSession } from "@/components/school/classes/forum/context/use-session";
import type { ForumPost } from "@/components/school/classes/forum/conversation/data/entities";

/**
 * Keeps post-level quick actions grouped together so reply and reaction updates
 * stay close to the post they mutate.
 */
export const PostItemActions = ({ post }: { post: ForumPost }) => {
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
    <Group
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
          <TooltipPopup side="top">{t("reaction")}</TooltipPopup>
        </Tooltip>
        <PopoverPopup align="end" className="w-fit p-0">
          <EmojiPicker
            className="h-80"
            onEmojiSelect={({ emoji }) => {
              startTransition(async () => {
                await toggleReaction({ postId: post._id, emoji });
              });
              reactionPicker.close();
            }}
          >
            <EmojiPickerSearch />
            <EmojiPickerContent />
            <EmojiPickerFooter />
          </EmojiPicker>
        </PopoverPopup>
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
        <TooltipPopup side="top">{t("reply")}</TooltipPopup>
      </Tooltip>
    </Group>
  );
};
PostItemActions.displayName = "PostItemActions";
