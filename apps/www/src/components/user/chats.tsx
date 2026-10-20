"use client";

import { PaginatedQueryResult } from "@confect/react";
import {
  Delete02Icon,
  Globe02Icon,
  MoreHorizontalIcon,
  SquareLock01Icon,
} from "@hugeicons/core-free-icons";
import { CHAT_LIST_PAGE_SIZE } from "@repo/backend/client/chats/list";
import chats from "@repo/backend/confect/_generated/refs/chats";
import type { ChatView } from "@repo/backend/confect/chats/view";
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
import { Array as Arr, Effect, Option, pipe, String as Str } from "effect";
import { useState } from "react";
import { useLocale, useTranslations } from "use-intl";
import type { StoreApi } from "zustand";
import {
  type ChatFirstPage,
  useChatList,
} from "@/components/ai/chat/chats";
import { useDeleteChatMutation } from "@/components/ai/chat/mutation";
import { useConvexAuth } from "@/components/providers/convex";
import { formatShortAge } from "@/components/user/age";
import type { AgeClock } from "@/components/user/clock";
import { useAgeClock, useAgeNow } from "@/components/user/ages";
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
import { usePaginatedPreloaded } from "@/lib/data/paginated";
import type { PublicProfile } from "@/lib/profile/public";

/**
 * The study chats of the profile's owner, in the anatomy every row of the profile shares.
 * The profile is the owner's alone, because its loader answers anyone else with not found,
 * so the list needs no viewer check. The loader's first page is on the screen before the
 * browser connects, and the live list takes its place once the session settles. The next
 * page loads as the end of the list comes into view.
 */
export function UserChats({
  first,
  now: serverNow,
  profile,
}: {
  first: Option.Option<ChatFirstPage>;
  now: number;
  profile: PublicProfile;
}) {
  const t = useTranslations("Common");
  // The list subscribes once Convex has settled the session, as the sidebar's list does.
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const pagination = usePaginatedPreloaded(
    chats.queries.getOwnChats,
    isSettled ? { type: "study" } : "skip",
    { initialNumItems: CHAT_LIST_PAGE_SIZE },
    first
  );
  const { loadMore, results } = useChatList(pagination);
  const clock = useAgeClock(serverNow);
  if (PaginatedQueryResult.isFailure(pagination)) {
    throw pagination.error;
  }
  if (PaginatedQueryResult.isLoadingFirstPage(pagination)) {
    return null;
  }
  if (results.length === 0) {
    return <FeedEmpty>{t("no-chats")}</FeedEmpty>;
  }
  return (
    <div className="flex flex-col">
      {Arr.map(results, (chat) => (
        <ChatRow chat={chat} clock={clock} key={chat._id} profile={profile} />
      ))}
      {loadMore ? <Intersection onIntersect={loadMore} /> : null}
    </div>
  );
}

/**
 * One chat, as a post of the owner: the owner's picture, then the name, the age,
 * whether the chat is private or shared, and its More menu on one line, then
 * the whole title, which holds at most 80 characters. The title is the row's
 * link, and the whole row opens the chat.
 */
function ChatRow({
  chat,
  clock,
  profile,
}: {
  chat: ChatView;
  clock: StoreApi<AgeClock>;
  profile: PublicProfile;
}) {
  const tAi = useTranslations("Ai");
  const locale = useLocale();
  const now = useAgeNow(clock);
  const isPrivate = chat.visibility === "private";
  // A chat Nina has not named yet reads as a new chat, so its link has a name.
  const title = pipe(
    Option.fromUndefinedOr(chat.title),
    Option.filter(Str.isNonEmpty),
    Option.getOrElse(() => tAi("new-chat"))
  );
  return (
    <FeedRow>
      <FeedAvatar mascot={profile.mascot} photo={profile.image} />
      <FeedBody>
        <FeedHeader>
          <FeedName>{profile.name}</FeedName>
          <FeedAge at={chat.updatedAt}>
            {formatShortAge(chat.updatedAt, now, locale)}
          </FeedAge>
          <HugeIcons
            aria-label={tAi(isPrivate ? "private" : "public")}
            className="size-4 text-muted-foreground"
            icon={isPrivate ? SquareLock01Icon : Globe02Icon}
            role="img"
          />
          <FeedEnd>
            <UserChatsListActions chat={chat} />
          </FeedEnd>
        </FeedHeader>
        <NavigationLink
          className="wrap-anywhere rounded-sm outline-none after:absolute after:inset-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          dir="auto"
          href={`/chat/${chat._id}`}
        >
          {title}
        </NavigationLink>
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
