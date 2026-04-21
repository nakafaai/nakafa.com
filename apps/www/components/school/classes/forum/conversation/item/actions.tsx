import { ArrowTurnBackwardIcon, WinkIcon } from "@hugeicons/core-free-icons";
import { useDisclosure } from "@mantine/hooks";
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
import { useTranslations } from "next-intl";
import { memo, useTransition } from "react";
import { useForum } from "@/components/school/classes/forum/conversation/context/use-forum";
import type { ForumPost } from "@/components/school/classes/forum/conversation/models";

/**
 * Keeps post-level quick actions grouped together so reply and reaction updates
 * stay close to the post they mutate.
 */
export const PostItemActions = memo(({ post }: { post: ForumPost }) => {
  const t = useTranslations("Common");
  const setReplyTo = useForum((state) => state.setReplyTo);
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
              <PopoverTrigger asChild>
                <Button disabled={isPending} size="icon" variant="outline">
                  <HugeIcons icon={WinkIcon} />
                  <span className="sr-only">{t("reaction")}</span>
                </Button>
              </PopoverTrigger>
            }
          />
          <TooltipContent side="top">{t("reaction")}</TooltipContent>
        </Tooltip>
        <PopoverContent align="end" className="w-fit p-0">
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
        </PopoverContent>
      </Popover>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              onClick={() => setReplyTo({ postId: post._id, userName })}
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
});
PostItemActions.displayName = "PostItemActions";
