"use client";

import { PaginatedQueryResult, usePaginatedQuery } from "@confect/react";
import {
  Delete02Icon,
  Globe02Icon,
  MoreHorizontalIcon,
  SquareLock01Icon,
} from "@hugeicons/core-free-icons";
import { CHAT_LIST_PAGE_SIZE } from "@repo/backend/client/chats/list";
import chats from "@repo/backend/confect/_generated/refs/chats";
import type { ChatView } from "@repo/backend/confect/chats/view";
import { photoOf } from "@repo/backend/confect/users/picture";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { toast } from "@repo/design-system/lib/toast/notify";
import {
  Array as Arr,
  DateTime,
  Effect,
  Option,
  pipe,
  String as Str,
} from "effect";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useChatList } from "@/components/ai/chat/history.client";
import { useDeleteChatMutation } from "@/components/ai/chat/mutation.client";
import { formatShortAge } from "@/components/user/age";
import {
  FeedAge,
  FeedAvatar,
  FeedBody,
  FeedEmpty,
  FeedEnd,
  FeedHeader,
  FeedName,
  FeedRow,
} from "@/components/user/feed";
import { reportClientException } from "@/lib/analytics/client";
import { useViewer } from "@/lib/identity/client";

/**
 * Render the chats of a profile. A learner sees their own chats, private and
 * shared. A shared chat is reached by its link alone, so a profile lists no
 * chat of anyone else.
 */
export function UserChats({ userId }: { userId: Id<"users"> }) {
  const user = useViewer((state) => state.account);
  const isPending = useViewer((state) => state.isPending);

  if (user?.appUser._id === userId) {
    return <OwnChatsList />;
  }
  if (isPending) {
    return (
      <ChatList canDelete={false} isLoading loadMore={undefined} results={[]} />
    );
  }
  return <ChatsByLink />;
}

/** What another learner's profile says in place of a list: a chat opens by its link. */
function ChatsByLink() {
  const t = useTranslations("Common");
  return <FeedEmpty>{t("chats-by-link")}</FeedEmpty>;
}

/** Subscribe to all study chats owned by the current viewer. */
function OwnChatsList() {
  const pagination = usePaginatedQuery(
    chats.queries.getOwnChats,
    {
      type: "study",
    },
    {
      initialNumItems: CHAT_LIST_PAGE_SIZE,
    }
  );
  const { loadMore, results } = useChatList(pagination);
  if (PaginatedQueryResult.isFailure(pagination)) {
    throw pagination.error;
  }
  return (
    <ChatList
      canDelete={true}
      isLoading={PaginatedQueryResult.isLoadingFirstPage(pagination)}
      loadMore={loadMore}
      results={results}
    />
  );
}

/**
 * The chats of a page, in the anatomy every row of the profile shares. Nothing
 * shows while the first page loads, and the next page loads as the end of the
 * list comes into view.
 */
function ChatList({
  canDelete,
  loadMore,
  results,
  isLoading,
}: {
  canDelete: boolean;
  loadMore: (() => void) | undefined;
  results: readonly ChatView[];
  isLoading: boolean;
}) {
  const t = useTranslations("Common");
  if (isLoading) {
    return null;
  }
  if (results.length === 0) {
    return <FeedEmpty>{t("no-chats")}</FeedEmpty>;
  }
  return (
    <div className="flex flex-col">
      {Arr.map(results, (chat) => (
        <ChatRow canDelete={canDelete} chat={chat} key={chat._id} />
      ))}
      {loadMore ? <Intersection onIntersect={loadMore} /> : null}
    </div>
  );
}

/**
 * One chat: the owner's picture, then its title, whether it is private or
 * shared, its age and the owner's More menu on one line. The title is the
 * row's link, and the whole row opens the chat.
 */
function ChatRow({ canDelete, chat }: { canDelete: boolean; chat: ChatView }) {
  const tAi = useTranslations("Ai");
  const locale = useLocale();
  const account = useViewer((state) => state.account);
  const now = DateTime.toEpochMillis(DateTime.nowUnsafe());
  const isPrivate = chat.visibility === "private";
  // A chat Nina has not named yet reads as a new chat, so its link has a name.
  const title = pipe(
    Option.fromUndefinedOr(chat.title),
    Option.filter(Str.isNonEmpty),
    Option.getOrElse(() => tAi("new-chat"))
  );
  return (
    <FeedRow>
      {account && (
        <FeedAvatar
          mascot={account.appUser.mascot}
          photo={photoOf(account.appUser)}
        />
      )}
      <FeedBody>
        <FeedHeader>
          <FeedName>
            <NavigationLink
              className="after:absolute after:inset-0"
              href={`/chat/${chat._id}`}
            >
              {title}
            </NavigationLink>
          </FeedName>
          <HugeIcons
            aria-label={tAi(isPrivate ? "private" : "public")}
            className="size-4 text-muted-foreground"
            icon={isPrivate ? SquareLock01Icon : Globe02Icon}
            role="img"
          />
          <FeedAge at={chat.updatedAt}>
            {formatShortAge(chat.updatedAt, now, locale)}
          </FeedAge>
          {canDelete ? (
            <FeedEnd>
              <UserChatsListActions chat={chat} />
            </FeedEnd>
          ) : null}
        </FeedHeader>
      </FeedBody>
    </FeedRow>
  );
}

/** Render owner actions for one profile chat row. */
function UserChatsListActions({ chat }: { chat: ChatView }) {
  const t = useTranslations("Common");
  const tAi = useTranslations("Ai");
  const deleteChat = useDeleteChatMutation();
  const [confirmDelete, setConfirmDelete] = useState(false);

  /**
   * Delete this chat through the optimistic list mutation, once the learner
   * confirms in the dialog. The dialog closes first, as the row leaves the list.
   */
  function handleDelete() {
    setConfirmDelete(false);
    Effect.runFork(
      Effect.asVoid(
        Effect.tryPromise(() =>
          deleteChat({
            chatId: chat._id,
          })
        ).pipe(Effect.flatMap(Effect.fromResult))
      ).pipe(
        Effect.matchEffect({
          onSuccess: () => Effect.void,
          onFailure: (error) =>
            reportClientException(error, {
              source: "components/user/chats",
            }).pipe(
              Effect.andThen(
                Effect.sync(() => {
                  toast.error({
                    description: "action-error.description",
                    title: "action-error.title",
                  });
                })
              )
            ),
        })
      )
    );
  }
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={t("more-actions")}
              size="icon-sm"
              variant="ghost"
            >
              <HugeIcons icon={MoreHorizontalIcon} />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => setConfirmDelete(true)}
            variant="destructive"
          >
            <HugeIcons icon={Delete02Icon} />
            {t("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ResponsiveDialog
        description={tAi("delete-chat-description")}
        footer={
          <Button onClick={handleDelete} variant="destructive">
            <HugeIcons icon={Delete02Icon} />
            {tAi("confirm")}
          </Button>
        }
        open={confirmDelete}
        setOpen={setConfirmDelete}
        title={tAi("delete-chat")}
      />
    </>
  );
}
