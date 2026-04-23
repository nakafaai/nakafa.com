import { Response } from "@repo/design-system/components/ai/response";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import { cn } from "@repo/design-system/lib/utils";
import { format } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
import { Activity, type ComponentProps, memo } from "react";
import { useData } from "@/components/school/classes/forum/conversation/context/use-data";
import { useSession } from "@/components/school/classes/forum/conversation/context/use-session";
import { useViewport } from "@/components/school/classes/forum/conversation/context/use-viewport";
import type { ForumPost } from "@/components/school/classes/forum/conversation/data/entities";
import { PostItemActions } from "@/components/school/classes/forum/conversation/item/actions";
import { PostAttachments } from "@/components/school/classes/forum/conversation/item/attachments";
import { PostReactions } from "@/components/school/classes/forum/conversation/item/reactions";
import { PostReplyIndicator } from "@/components/school/classes/forum/conversation/item/reply-indicator";
import { getLocale } from "@/lib/utils/date";
import { getInitialName } from "@/lib/utils/helper";

/** Renders one forum post row with reply, attachment, and reaction controls. */
export const ForumPostItem = memo(
  ({
    post,
    isFirstInGroup,
    isLastInGroup,
    itemRef,
  }: {
    post: ForumPost;
    isFirstInGroup: boolean;
    isLastInGroup: boolean;
    itemRef?: ComponentProps<"div">["ref"];
  }) => {
    const t = useTranslations("Common");
    const locale = useLocale();
    const currentUserId = useData((state) => state.currentUserId);
    const replyTo = useSession((state) => state.replyTo);
    const userName = post.user?.name ?? t("anonymous");
    const userImage = post.user?.image ?? "";
    const isJumpHighlighted = useViewport(
      (state) => state.highlightedPostId === post._id
    );
    const isReplyTo = replyTo?.postId === post._id;
    const isReplyToMe = post.replyToUserId === currentUserId;

    return (
      <div
        className={cn(
          "min-w-0",
          isFirstInGroup === true && "pt-3",
          isLastInGroup === true && "pb-3"
        )}
      >
        <div
          className={cn(
            "group relative flex items-start gap-3 border-l-2 border-l-transparent px-4 py-1.5 transition-colors ease-out hover:bg-accent/20",
            isReplyToMe === true && "border-primary bg-primary/10",
            isReplyTo === true && "border-secondary bg-secondary/10",
            isJumpHighlighted === true && "border-secondary bg-secondary/10"
          )}
          data-post-id={post._id}
          id={post._id}
          ref={itemRef}
        >
          <PostItemActions post={post} />

          <div className="w-8 shrink-0">
            <Activity mode={isFirstInGroup === true ? "visible" : "hidden"}>
              <Avatar className="size-8 shrink-0">
                <AvatarImage alt={userName} src={userImage} />
                <AvatarFallback>{getInitialName(userName)}</AvatarFallback>
              </Avatar>
            </Activity>
            <time
              className={cn(
                "mt-1 block w-full text-center text-muted-foreground text-xs",
                isFirstInGroup === true && "hidden",
                isFirstInGroup !== true && isLastInGroup !== true && "invisible"
              )}
              title={format(post._creationTime, "PPpp", {
                locale: getLocale(locale),
              })}
            >
              {format(post._creationTime, "HH:mm", {
                locale: getLocale(locale),
              })}
            </time>
          </div>

          <div className="grid min-w-0 flex-1 gap-2">
            <div className="grid gap-1">
              <Activity mode={isFirstInGroup === true ? "visible" : "hidden"}>
                <div className="flex min-w-0 items-center gap-2">
                  <span className="min-w-0 truncate font-medium text-sm">
                    {userName}
                  </span>
                  <time
                    className="min-w-0 truncate text-muted-foreground text-xs tracking-tight"
                    title={format(post._creationTime, "PPpp", {
                      locale: getLocale(locale),
                    })}
                  >
                    {format(post._creationTime, "HH:mm", {
                      locale: getLocale(locale),
                    })}
                  </time>
                </div>
              </Activity>

              <PostReplyIndicator post={post} />

              <Activity mode={post.body.trim() ? "visible" : "hidden"}>
                <div className="wrap-break-word min-w-0 text-chat">
                  <Response id={post._id}>{post.body}</Response>
                </div>
              </Activity>

              <PostAttachments attachments={post.attachments} />
            </div>

            <PostReactions post={post} />
          </div>
        </div>
      </div>
    );
  }
);
ForumPostItem.displayName = "ForumPostItem";
