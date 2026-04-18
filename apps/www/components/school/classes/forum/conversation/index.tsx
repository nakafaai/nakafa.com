"use client";

import type { Id } from "@repo/backend/convex/_generated/dataModel";
import {
  VirtualConversation,
  VirtualConversationPlaceholder,
} from "@repo/design-system/components/ui/virtual-conversation";
import { useTranslations } from "next-intl";
import { Activity, memo } from "react";
import { ForumHeader } from "@/components/school/classes/forum/conversation/header";
import { useController } from "@/components/school/classes/forum/conversation/hooks/use-controller";
import { ForumPostInput } from "@/components/school/classes/forum/conversation/input";
import { ForumPostItem } from "@/components/school/classes/forum/conversation/item";
import {
  DateSeparator,
  JumpModeIndicator,
  UnreadSeparator,
} from "@/components/school/classes/forum/conversation/separators";
import type { Forum } from "@/components/school/classes/forum/conversation/types";
import { ForumScrollProvider } from "@/lib/context/use-forum-scroll";

/** Renders the forum conversation shell around the extracted controller state. */
export const ForumPostConversation = memo(
  ({
    forum,
    forumId,
    currentUserId,
  }: {
    forum: Forum | undefined;
    forumId: Id<"schoolClassForums">;
    currentUserId: Id<"users">;
  }) => {
    const t = useTranslations("Common");
    const {
      forumScrollValue,
      handleScroll,
      handleScrollEnd,
      handleVirtualAnchorReady,
      hasPendingPostTarget,
      initialAnchor,
      isAtLatestEdge,
      isInitialLoading,
      isJumpMode,
      isPrepending,
      items,
      scrollRef,
      scrollToLatest,
      timelineSessionVersion,
    } = useController({
      forum,
      forumId,
    });

    if (isInitialLoading || !forum) {
      return <VirtualConversationPlaceholder />;
    }

    return (
      <ForumScrollProvider value={forumScrollValue}>
        <div className="relative flex size-full flex-col overflow-hidden">
          <VirtualConversation
            floatingContent={
              <Activity
                mode={isJumpMode || hasPendingPostTarget ? "visible" : "hidden"}
              >
                <JumpModeIndicator onExit={scrollToLatest} />
              </Activity>
            }
            followLatest={isAtLatestEdge}
            hideScrollButton={isJumpMode || hasPendingPostTarget}
            initialAnchor={initialAnchor}
            key={timelineSessionVersion}
            onInitialAnchorSettled={handleVirtualAnchorReady}
            onScroll={handleScroll}
            onScrollEnd={handleScrollEnd}
            scrollButtonAction={scrollToLatest}
            scrollButtonAriaLabel={t("back-to-latest")}
            scrollRef={scrollRef}
            shift={isPrepending}
          >
            {items.map((item) => {
              if (item.type === "header") {
                return <ForumHeader forum={item.forum} key="header" />;
              }

              if (item.type === "date") {
                return (
                  <DateSeparator date={item.date} key={`date-${item.date}`} />
                );
              }

              if (item.type === "unread") {
                return <UnreadSeparator count={item.count} key="unread" />;
              }

              return (
                <ForumPostItem
                  currentUserId={currentUserId}
                  isFirstInGroup={item.isFirstInGroup}
                  key={item.post._id}
                  post={item.post}
                />
              );
            })}
          </VirtualConversation>
          <ForumPostInput forumId={forumId} />
        </div>
      </ForumScrollProvider>
    );
  }
);
ForumPostConversation.displayName = "ForumPostConversation";
