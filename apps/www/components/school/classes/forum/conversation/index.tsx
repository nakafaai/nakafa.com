"use client";

import type { Id } from "@repo/backend/convex/_generated/dataModel";
import {
  VirtualConversation,
  VirtualConversationPlaceholder,
} from "@repo/design-system/components/ui/virtual-conversation";
import { useTranslations } from "next-intl";
import { memo } from "react";
import { ForumHeader } from "@/components/school/classes/forum/conversation/header";
import { useController } from "@/components/school/classes/forum/conversation/hooks/use-controller";
import { ForumPostInput } from "@/components/school/classes/forum/conversation/input";
import { ForumPostItem } from "@/components/school/classes/forum/conversation/item";
import { JumpBar } from "@/components/school/classes/forum/conversation/jump-bar";
import {
  DateSeparator,
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
      acknowledgeUnreadCue,
      canGoBack,
      forumScrollValue,
      goBack,
      handleScroll,
      handleInitialAnchorSettled,
      highlightedPostId,
      initialAnchor,
      isAtBottom,
      isAtLatestEdge,
      isInitialLoading,
      items,
      containerRef,
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

    const showJumpBack = canGoBack;
    const showJumpLatest = showJumpBack && !(isAtLatestEdge && isAtBottom);

    return (
      <ForumScrollProvider value={forumScrollValue}>
        <div className="relative flex size-full flex-col overflow-hidden">
          <VirtualConversation
            containerRef={containerRef}
            estimateSize={(index) => {
              const item = items[index];

              if (!item) {
                return 120;
              }

              if (item.type === "header") {
                return 120;
              }

              if (item.type === "date" || item.type === "unread") {
                return 48;
              }

              return 160;
            }}
            floatingContent={
              showJumpBack ? (
                <JumpBar
                  onBack={goBack}
                  onLatest={scrollToLatest}
                  showBack={showJumpBack}
                  showLatest={showJumpLatest}
                />
              ) : null
            }
            hideScrollButton={canGoBack}
            initialAnchor={initialAnchor}
            key={timelineSessionVersion}
            onInitialAnchorSettled={handleInitialAnchorSettled}
            onScroll={handleScroll}
            scrollButtonAction={scrollToLatest}
            scrollButtonAriaLabel={t("back-to-latest")}
            scrollRef={scrollRef}
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
                return (
                  <UnreadSeparator
                    count={item.count}
                    key="unread"
                    status={item.status}
                  />
                );
              }

              return (
                <ForumPostItem
                  currentUserId={currentUserId}
                  isFirstInGroup={item.isFirstInGroup}
                  isJumpHighlighted={highlightedPostId === item.post._id}
                  isLastInGroup={item.isLastInGroup}
                  key={item.post._id}
                  post={item.post}
                  showContinuationTime={item.showContinuationTime}
                />
              );
            })}
          </VirtualConversation>
          <ForumPostInput
            acknowledgeUnreadCue={acknowledgeUnreadCue}
            forumId={forumId}
          />
        </div>
      </ForumScrollProvider>
    );
  }
);
ForumPostConversation.displayName = "ForumPostConversation";
