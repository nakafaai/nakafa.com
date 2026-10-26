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
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Array as Arr, Effect, Option, pipe, String as Str } from "effect";
import { createContext, use, useState } from "react";
import { useTranslations } from "use-intl";
import type { StoreApi } from "zustand";
import { type ChatFirstPage, useChatList } from "@/components/ai/chat/chats";
import { useDeleteChatMutation } from "@/components/ai/chat/mutation";
import { useConvexAuth } from "@/components/auth/convex";
import { SignedInIsland } from "@/components/providers/island";
import { formatShortAge } from "@/components/user/age";
import { useAgeClock, useAgeNow } from "@/components/user/ages";
import type { AgeClock } from "@/components/user/clock";
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
import { Link, useCurrentLocale } from "@/lib/routing/link";
import { EXACT_ACTIVE_OPTIONS } from "@/lib/routing/tree";

/**
 * The owner's chats of a profile, in the anatomy every row of the profile shares.
 * The profile is the owner's alone, because its loader answers anyone else with not
 * found, so the list needs no viewer check. Only the owner holds a client on this
 * page, so the list mounts once the page has one, and no visitor reads it.
 */
export function UserChats({
  first,
  now,
  profile,
}: {
  first: Option.Option<ChatFirstPage>;
  now: number;
  profile: PublicProfile;
}) {
  return (
    <UserChatsContext value={{ first, now, profile }}>
      <SignedInIsland fallback={<StaticUserChats />}>
        <LiveUserChats />
      </SignedInIsland>
    </UserChatsContext>
  );
}

/** The owner whose chats the list shows, as the author of every row, the loader's first page, and the time it read it. */
const UserChatsContext = createContext<{
  first: Option.Option<ChatFirstPage>;
  now: number;
  profile: PublicProfile;
} | null>(null);

/** Reads the chats list around a variant or a row. */
function useUserChats() {
  const value = use(UserChatsContext);
  if (value === null) {
    throw new Error("useUserChats must be used within UserChats");
  }
  return value;
}

/** The age clock of the rows, and whether they are live, so only a live row mounts its menu. */
const ChatRowsContext = createContext<{
  clock: StoreApi<AgeClock>;
  live: boolean;
} | null>(null);

/**
 * The loader's first page as the rows of the profile, before the client arrives.
 * The rows hold their final size, with a frame where each menu will be, and mount
 * no client. A failed first read shows nothing, because no page is known.
 */
function StaticUserChats() {
  const { first, now: serverNow } = useUserChats();
  const clock = useAgeClock(serverNow);
  return Option.match(first, {
    onNone: () => null,
    onSome: (page) => (
      <ChatRowsContext value={{ clock, live: false }}>
        <ChatRows chats={page.page} loadMore={undefined} />
      </ChatRowsContext>
    ),
  });
}

/**
 * The live list of the owner's chats, which starts from the loader's first page.
 * The loader's page is on the screen before the browser connects, and the list
 * takes its place once the session settles. The next page loads as the end of the
 * list comes into view.
 */
function LiveUserChats() {
  const { first, now: serverNow } = useUserChats();
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
  return (
    <ChatRowsContext value={{ clock, live: true }}>
      <ChatRows chats={results} loadMore={loadMore} />
    </ChatRowsContext>
  );
}

/**
 * The rows of the owner's chats, with the end trigger that loads the next page as
 * it comes into view. Only a live row mounts its menu, because the menu needs the
 * client.
 */
function ChatRows({
  chats,
  loadMore,
}: {
  chats: readonly ChatView[];
  loadMore: (() => void) | undefined;
}) {
  const t = useTranslations("Common");
  if (chats.length === 0) {
    return <FeedEmpty>{t("no-chats")}</FeedEmpty>;
  }
  return (
    <div className="flex flex-col">
      {Arr.map(chats, (chat) => (
        <ChatRow chat={chat} key={chat._id} />
      ))}
      {loadMore ? (
        <Intersection key={chats.length} onIntersect={loadMore} />
      ) : null}
    </div>
  );
}

/**
 * One chat, as a post of the owner: the owner's picture, then the name, the age,
 * whether the chat is private or shared, and its More menu on one line, then
 * the whole title, which holds at most 80 characters. The title is the row's
 * link, and the whole row opens the chat.
 */
function ChatRow({ chat }: { chat: ChatView }) {
  const { profile } = useUserChats();
  const rows = use(ChatRowsContext);
  if (rows === null) {
    throw new Error("ChatRow must be used within ChatRowsContext");
  }
  const { clock, live } = rows;
  const tAi = useTranslations("Ai");
  const locale = useCurrentLocale();
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
            {live ? <UserChatsListActions chat={chat} /> : <ChatActionsFrame />}
          </FeedEnd>
        </FeedHeader>
        <Link
          activeOptions={EXACT_ACTIVE_OPTIONS}
          className="wrap-anywhere rounded-sm outline-none after:absolute after:inset-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          dir="auto"
          params={{ id: chat._id, locale }}
          to="/$locale/chat/$id"
        >
          {title}
        </Link>
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

/** The More button's place before the client arrives: the same size, with no menu behind it. */
function ChatActionsFrame() {
  const t = useTranslations("Common");
  return (
    <Button
      aria-label={t("more-actions")}
      disabled
      size="icon-sm"
      variant="ghost"
    >
      <HugeIcons icon={MoreHorizontalIcon} />
    </Button>
  );
}
