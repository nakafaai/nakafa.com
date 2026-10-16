"use client";

import { PaginatedQueryResult, usePaginatedQuery } from "@confect/react";
import {
  ArrowDown02Icon,
  Delete02Icon,
  Globe02Icon,
  MoreHorizontalIcon,
  SquareLock01Icon,
} from "@hugeicons/core-free-icons";
import { CHAT_LIST_PAGE_SIZE } from "@repo/backend/client/chats/list";
import chats from "@repo/backend/confect/_generated/refs/chats";
import type { ChatView } from "@repo/backend/confect/chats/view";
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
import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import { Array as Arr, Effect } from "effect";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useChange } from "@/components/ai/chat/change.client";
import { useChatList } from "@/components/ai/chat/history.client";
import { useDeleteChatMutation } from "@/components/ai/chat/mutation.client";
import { reportClientException } from "@/lib/analytics/client";
import { formatAge } from "@/lib/i18n/date";
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
  return (
    <p className="text-center text-muted-foreground text-sm">
      {t("chats-by-link")}
    </p>
  );
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

/** Render a resolved chat page with optional owner controls. */
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
  const locale = useLocale();
  if (isLoading) {
    return <Skeleton className="h-12 w-full rounded-xl border shadow-sm" />;
  }
  if (results.length === 0) {
    return (
      <p className="text-center text-muted-foreground text-sm">
        {t("no-chats")}
      </p>
    );
  }
  return (
    <>
      <div className="flex flex-col divide-y overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
        {Arr.map(results, (chat) => {
          const isPrivate = chat.visibility === "private";
          return (
            <div
              className="group relative flex flex-col justify-between gap-2 p-4 transition-colors ease-out hover:bg-accent hover:text-accent-foreground sm:flex-row sm:items-center"
              key={chat._id}
            >
              <NavigationLink
                className="absolute inset-0 z-1"
                href={`/chat/${chat._id}`}
              />
              <div className="flex flex-1 items-center gap-2">
                <HugeIcons
                  className="size-4 shrink-0"
                  icon={isPrivate ? SquareLock01Icon : Globe02Icon}
                />
                <span className="truncate text-sm">{chat.title}</span>
                <HugeIcons
                  className="size-4 shrink-0 -rotate-90 opacity-0 transition-opacity ease-out group-hover:opacity-100"
                  icon={ArrowDown02Icon}
                />
              </div>

              <div className="flex shrink-0 items-center justify-between gap-2">
                <time className="truncate text-muted-foreground text-sm tracking-tight group-hover:text-accent-foreground">
                  {formatAge(chat.updatedAt, locale)}
                </time>
                {canDelete ? <UserChatsListActions chat={chat} /> : null}
              </div>
            </div>
          );
        })}
      </div>
      {loadMore ? <Intersection onIntersect={loadMore} /> : null}
    </>
  );
}

/** Render owner actions for one profile chat row. */
function UserChatsListActions({ chat }: { chat: ChatView }) {
  const actionErrorMessage = useTranslations("Common")("action-error");
  const t = useTranslations("Common");
  const deleteChat = useDeleteChatMutation();
  const { change, isPending } = useChange();

  /** Delete this chat through the optimistic list mutation. */
  function handleDelete() {
    change(() =>
      Effect.runPromise(
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
                    toast.error(actionErrorMessage);
                  })
                )
              ),
          })
        )
      )
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            className="z-2 hover:bg-background hover:text-foreground hover:[&_svg]:text-foreground"
            disabled={isPending}
            size="icon-sm"
            variant="ghost"
          >
            <HugeIcons icon={MoreHorizontalIcon} />
            <span className="sr-only">More actions</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem
          className="cursor-pointer"
          disabled={isPending}
          onClick={handleDelete}
          variant="destructive"
        >
          <HugeIcons icon={Delete02Icon} />
          {t("delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
