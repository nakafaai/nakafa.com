import {
  PaginatedQueryResult,
  QueryResult,
  usePaginatedQuery,
  useQuery,
} from "@confect/react";
import type { Id } from "@repo/backend/confect/_generated/id";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { cva } from "class-variance-authority";
import { cn } from "cn";
import { Array as Arr, Option } from "effect";
import { useEffect, useState } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import {
  pageGutterVariants,
  readingMeasureVariants,
} from "@/components/shared/content/width";
import { useKeptPlace } from "@/components/shared/place";
import { reloadPage } from "@/components/shared/reload";
import { EmptyState } from "@/components/state/empty";
import { LoadFailure } from "@/components/state/failure";
import { EmptyNina } from "@/components/state/nina";
import { CHANNEL_PAGE_SIZE } from "@/components/tenant/classes/channels";
import { ForumComposer } from "@/components/tenant/classes/forum/composer";
import { showsUnreadStart } from "@/components/tenant/classes/forum/marks";
import {
  ChannelScopeContext,
  PlaceShownContext,
  useChannelScope,
  usePlaceChat,
  useReadPlace,
} from "@/components/tenant/classes/forum/scope";
import { MessageStream } from "@/components/tenant/classes/forum/stream";
import { useClassScope } from "@/components/tenant/classes/scope";
import { isLostAccess } from "@/components/tenant/refusal";
import { firstPageOf } from "@/lib/scroll/place";

/** How many messages a place reads each time its oldest loaded message comes into view. */
export const MESSAGE_PAGE_SIZE = 30;

/** The most messages a place reads before it opens: four pages, to reach its first unread message or its kept place. */
export const MESSAGE_OPEN_MOST = 4 * MESSAGE_PAGE_SIZE;

/** A chat on screen fills its room; a chat kept out of sight keeps its layout and its scroll, unseen and inert. */
const chatPlaceVariants = cva("flex min-h-0 w-full min-w-0 flex-1 flex-col", {
  variants: {
    shown: {
      false: "invisible absolute inset-0",
      true: "",
    },
  },
});

/**
 * One channel of a class as a chat: its messages fill the room it is given, oldest at the top and
 * the newest at the bottom, and the composer is its footer, for a member of the class or a subject
 * teacher. The school's leaders read the channel and write in none, so they see a sentence that
 * says who writes there in place of the composer, and an archived channel says so in its place.
 * A chat the forum keeps out of sight (`shown` false) reads its messages and draws nothing until
 * it is first shown, and once drawn it keeps its place while hidden, so opening it waits on no read.
 */
export function ForumChannel({
  canManage,
  canPost,
  channelId,
  everyone,
  jump,
  shown,
}: {
  canManage: boolean;
  canPost: boolean;
  channelId: Id<"classroomChannels">;
  /** Whether the viewer, a subject teacher, may mention everyone. */
  everyone: boolean;
  jump: Option.Option<Id<"classroomMessages">>;
  /** Whether the chat is on screen, not kept out of sight for the reader's next press. */
  shown: boolean;
}) {
  const t = useTranslations("Classroom");
  const { classId, slug } = useClassScope();
  // Whether the chat was ever on screen: it draws from then on, shown or kept.
  const [drawn, setDrawn] = useState(shown);
  if (shown && !drawn) {
    setDrawn(true);
  }
  const channels = usePaginatedQuery(
    classroom.forum.channels.list,
    { classId, slug },
    { initialNumItems: CHANNEL_PAGE_SIZE }
  );
  const archived =
    !PaginatedQueryResult.isFailure(channels) &&
    Arr.some(
      channels.results,
      (channel) => channel.id === channelId && channel.archived
    );

  return (
    <ChannelScopeContext
      value={{
        canManage,
        canPost,
        channelId,
        classId,
        discussion: undefined,
        everyone,
        jump,
        slug,
      }}
    >
      <PlaceShownContext value={shown}>
        <div
          aria-hidden={shown ? undefined : true}
          className={chatPlaceVariants({ shown })}
          inert={!shown}
        >
          <ChannelMessages drawn={drawn} />
          {drawn ? (
            <footer
              className={cn(
                readingMeasureVariants(),
                pageGutterVariants(),
                "shrink-0 pt-2 pb-4"
              )}
            >
              {canPost ? (
                <ForumComposer />
              ) : (
                <p className="text-muted-foreground text-center text-sm">
                  {t(archived ? "channel-archived" : "read-only")}
                </p>
              )}
            </footer>
          ) : null}
        </div>
      </PlaceShownContext>
    </ChannelScopeContext>
  );
}

/**
 * The messages of the channel, read once Convex has settled the session with the viewer's read
 * mark, so the channel opens where the viewer stopped reading. The first read holds the place the
 * reader left the channel at in this browser, and when every message it holds is unread it reads
 * older ones once more, up to `MESSAGE_OPEN_MOST`, so the channel opens at its first unread message.
 * Once open, the next older page loads when the oldest loaded message comes into view, so the list
 * has no button. A channel with no message shows its empty state, a failed read its sentence and
 * Try again, and a viewer who lost the school's access is sent to the refused page. A chat out of
 * sight that was never shown reads all of this and draws nothing yet.
 */
function ChannelMessages({
  drawn,
}: {
  /** Whether the chat draws its messages, or only reads them while it waits out of sight. */
  drawn: boolean;
}) {
  const t = useTranslations("Classroom");
  const { channelId, classId, slug } = useChannelScope();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const place = useReadPlace();
  const kept = useKeptPlace(usePlaceChat());
  const pagination = usePaginatedQuery(
    classroom.forum.messages.page,
    isSettled ? { channelId, classId, slug } : "skip",
    { initialNumItems: firstPageOf(kept, MESSAGE_PAGE_SIZE, MESSAGE_OPEN_MOST) }
  );
  const read = useQuery(
    classroom.forum.reads.get,
    isSettled ? { classId, place, slug } : "skip"
  );
  // Whether the messages are drawn: once they are, a later read of older pages never takes them away.
  const [open, setOpen] = useState(false);
  const loaded =
    !(
      pagination._tag === "LoadingFirstPage" ||
      PaginatedQueryResult.isFailure(pagination)
    ) && QueryResult.isSuccess(read);
  const messages = Arr.reverse(loaded ? pagination.results : []);
  const short =
    loaded &&
    !showsUnreadStart(
      messages,
      read.value.at,
      PaginatedQueryResult.isCanLoadMore(pagination)
    ) &&
    pagination.results.length < MESSAGE_OPEN_MOST;
  const opens = loaded && !short && pagination._tag !== "LoadingMore";
  if (opens && !open) {
    setOpen(true);
  }
  useEffect(() => {
    if (short && PaginatedQueryResult.isCanLoadMore(pagination)) {
      pagination.loadMore(MESSAGE_OPEN_MOST - pagination.results.length);
    }
  }, [short, pagination]);

  if (
    PaginatedQueryResult.isFailure(pagination) &&
    isLostAccess(pagination.error)
  ) {
    throw pagination.error;
  }
  if (
    PaginatedQueryResult.isFailure(pagination) ||
    QueryResult.isFailure(read)
  ) {
    return (
      <div className="flex-1 p-4">
        <LoadFailure onRetry={reloadPage} />
      </div>
    );
  }
  if (!drawn) {
    return null;
  }
  if (!((open || opens) && QueryResult.isSuccess(read))) {
    return <div className="flex-1" />;
  }
  if (Arr.isReadonlyArrayEmpty(messages)) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <EmptyState
          description={t("messages-empty-description")}
          scene={<EmptyNina act="typing" />}
          title={t("messages-empty")}
        />
      </div>
    );
  }

  return (
    <MessageStream
      at={read.value.at}
      loadOlder={
        PaginatedQueryResult.isCanLoadMore(pagination)
          ? () => pagination.loadMore(MESSAGE_PAGE_SIZE)
          : undefined
      }
      messages={messages}
      opening={Option.none()}
    />
  );
}
