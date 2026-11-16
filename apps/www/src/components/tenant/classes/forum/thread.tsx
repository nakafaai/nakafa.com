import {
  PaginatedQueryResult,
  QueryResult,
  usePaginatedQuery,
  useQuery,
} from "@confect/react";
import type { Id } from "@repo/backend/confect/_generated/id";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { threadTitle } from "@repo/backend/confect/classroom/forum/thread";
import { useNavigate } from "@tanstack/react-router";
import { Array as Arr, Option, Schema } from "effect";
import { createContext, use, useState } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { PaneHeader } from "@/components/shared/page/pane";
import { PagePane, useWide } from "@/components/shared/page/panes";
import { reloadPage } from "@/components/shared/reload";
import { LoadFailure } from "@/components/state/failure";
import { MESSAGE_PAGE_SIZE } from "@/components/tenant/classes/forum/channel";
import { ForumComposer } from "@/components/tenant/classes/forum/composer";
import { isTitled } from "@/components/tenant/classes/forum/marks";
import {
  OpenedThread,
  useOpening,
} from "@/components/tenant/classes/forum/open";
import {
  ChannelScopeContext,
  useChannelScope,
} from "@/components/tenant/classes/forum/scope";
import { MessageStream } from "@/components/tenant/classes/forum/stream";
import { useClassScope } from "@/components/tenant/classes/scope";
import { isLostAccess } from "@/components/tenant/refusal";
import { schoolClassChannelTarget } from "@/lib/routing/school/target";

/** The thread the pane shows. */
type ShownThread = typeof OpenedThread.Type;

/**
 * The two places the pane reads threads in, so a thread's reads stay in one place of the pane however it moves: the
 * thread on screen (`front`), and the next one while its replies load, in the other lane. Whether a thread is asked
 * (`open`) tells a move between threads from a fresh open.
 */
const Lanes = Schema.Struct({
  a: Schema.Option(OpenedThread),
  b: Schema.Option(OpenedThread),
  front: Schema.Literals(["a", "b"]),
  open: Schema.Boolean,
});

/** The lane that is not `lane`. */
const otherLane = (lane: (typeof Lanes.Type)["front"]) =>
  lane === "a" ? "b" : "a";

/** Whether `lane` holds the thread of the opening message `thread` holds. */
const holds = (lane: Option.Option<ShownThread>, thread: ShownThread) =>
  Option.exists(
    lane,
    (kept) => kept.opening.clientKey === thread.opening.clientKey
  );

/**
 * The lanes after the asked thread: kept as they are while they already show it; a thread asked while none was
 * open, or with none drawn, in front at once; the next thread in the back lane while the one on screen stays, and in
 * front once its replies are in (`backSettled`). Closing keeps the last thread in front while the phone's sheet slides
 * away.
 */
const nextLanes = (
  lanes: typeof Lanes.Type,
  asked: Option.Option<ShownThread>,
  backSettled: boolean
): typeof Lanes.Type => {
  const back = otherLane(lanes.front);
  const front = lanes[lanes.front];
  if (Option.isNone(asked)) {
    return lanes.open || Option.isSome(lanes[back])
      ? { ...lanes, [back]: Option.none(), open: false }
      : lanes;
  }
  if (holds(front, asked.value)) {
    return lanes.open && Option.isNone(lanes[back])
      ? lanes
      : { ...lanes, [back]: Option.none(), open: true };
  }
  if (!lanes.open || Option.isNone(front)) {
    return {
      ...lanes,
      [back]: Option.none(),
      [lanes.front]: asked,
      open: true,
    };
  }
  if (!holds(lanes[back], asked.value)) {
    return { ...lanes, [back]: asked };
  }
  return backSettled
    ? { ...lanes, front: back, [lanes.front]: Option.none() }
    : lanes;
};

/** What a thread's body draws from: its replies, page by page, and the viewer's read mark in it. */
function useThreadFeed(thread: Option.Option<ShownThread>) {
  const { classId, slug } = useClassScope();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const asked = Option.filter(thread, () => isSettled);
  const replies = usePaginatedQuery(
    classroom.forum.threads.replies,
    Option.match(asked, {
      onNone: () => "skip" as const,
      onSome: (kept) => ({ classId, number: kept.number, slug }),
    }),
    { initialNumItems: MESSAGE_PAGE_SIZE }
  );
  const read = useQuery(
    classroom.forum.reads.get,
    Option.match(asked, {
      onNone: () => "skip" as const,
      onSome: (kept) => ({
        classId,
        place: { _tag: "discussion" as const, number: kept.number },
        slug,
      }),
    })
  );

  return { read, replies };
}

/** What one thread's body draws from, read by the pane. */
type ThreadFeed = ReturnType<typeof useThreadFeed>;

/**
 * Whether a thread's body has what it draws: its first replies and the viewer's read mark, or the failure that says
 * why not. A thread that held no reply when it opened draws at once: nothing it waits for stands above its opening.
 */
const isSettledFeed = (thread: ShownThread, feed: ThreadFeed) =>
  thread.opening.discussion?.replies === 0 ||
  !(
    feed.replies._tag === "LoadingFirstPage" || QueryResult.isLoading(feed.read)
  );

/** The thread a pane draws, with the reads the pane keeps for it. */
const ThreadShownContext = createContext<
  Option.Option<{ readonly feed: ThreadFeed; readonly thread: ShownThread }>
>(Option.none());

/**
 * The thread pane of a chat (ADR 0025), as Slack and Discord open a thread: from the shell's top to the screen's
 * bottom at its right, beside the chat, which stays where it was; on a phone it is a sheet over the chat. The
 * discussion's address holds it open, so closing it, from its header's button, Escape or the sheet, leads back to its
 * chat. Its header holds its title, its body the opening message and the replies, and its footer the composer, for a
 * member of the class or a subject teacher.
 *
 * The pane reads each thread itself, in one of two lanes, so a thread draws whole, in one frame, wherever it shows:
 * beside the chat the pane stands from the moment the address asks a thread, a reload included, so the page never
 * narrows late, and shows the thread once its replies are in; the phone's sheet opens only then; and a move to
 * another thread keeps the last one on screen until the next holds its replies.
 */
export function ThreadPane({
  asked,
  canManage,
  canPost,
  everyone,
  jump,
  thread,
}: {
  /** Whether the address asks for a thread, so the pane stands beside the chat before the thread is read. */
  asked: boolean;
  canManage: boolean;
  canPost: boolean;
  /** Whether the viewer, a subject teacher, may mention everyone. */
  everyone: boolean;
  jump: Option.Option<Id<"classroomMessages">>;
  thread: Option.Option<ShownThread>;
}) {
  const navigate = useNavigate();
  const wide = useWide();
  const { classId, classSlug, slug } = useClassScope();
  const forget = useOpening((state) => state.forget);
  const [lanes, setLanes] = useState<typeof Lanes.Type>({
    a: thread,
    b: Option.none(),
    front: "a",
    open: Option.isSome(thread),
  });
  const feedA = useThreadFeed(lanes.a);
  const feedB = useThreadFeed(lanes.b);
  const feeds = { a: feedA, b: feedB };
  const back = otherLane(lanes.front);
  const next = nextLanes(
    lanes,
    thread,
    Option.exists(lanes[back], (kept) => isSettledFeed(kept, feeds[back]))
  );
  if (next !== lanes) {
    setLanes(next);
  }
  // The thread on screen, as the address asks it now while it still asks the same one.
  const front = Option.map(lanes[lanes.front], (kept) =>
    Option.getOrElse(
      Option.filter(thread, (asked) => holds(Option.some(kept), asked)),
      () => kept
    )
  );
  const feed = feeds[lanes.front];
  const drawn = Option.filter(front, (kept) => isSettledFeed(kept, feed));

  return (
    <PagePane
      label={Option.match(front, {
        onNone: () => "",
        onSome: (kept) =>
          kept.opening.discussion?.title ?? threadTitle(kept.opening),
      })}
      onClose={() => {
        forget();
        Option.map(front, (kept) =>
          navigate(schoolClassChannelTarget(slug, classSlug, kept.channelId))
        );
      }}
      open={asked && (wide || Option.isSome(drawn))}
    >
      {Option.match(drawn, {
        onNone: () => null,
        onSome: (kept) => (
          <div className="flex min-h-0 flex-1 flex-col" key={lanes.front}>
            <ChannelScopeContext
              value={{
                canManage,
                canPost,
                channelId: kept.channelId,
                classId,
                discussion: kept.number,
                everyone,
                jump,
                slug,
              }}
            >
              <ThreadShownContext value={Option.some({ feed, thread: kept })}>
                <ThreadContent />
              </ThreadShownContext>
            </ChannelScopeContext>
          </div>
        ),
      })}
    </PagePane>
  );
}

/** One thread in the pane: its header, its messages, and the composer or the sentence that says who writes. */
function ThreadContent() {
  const t = useTranslations("Classroom");
  const { canPost } = useChannelScope();

  return (
    <>
      <ThreadHeader />
      <div className="flex min-h-0 flex-1 flex-col" data-slot="discussion">
        <ThreadReplies />
        <footer className="shrink-0 px-4 pt-2 pb-4">
          {canPost ? (
            <ForumComposer />
          ) : (
            <p className="text-muted-foreground text-center text-sm">
              {t("read-only")}
            </p>
          )}
        </footer>
      </div>
    </>
  );
}

/**
 * The header of a thread, beside the chat with its close button and on a phone's sheet with its title alone: a titled
 * discussion's number and title, or Thread for a thread of a message, whose opening message right under the header
 * already says what a title would repeat.
 */
function ThreadHeader() {
  const t = useTranslations("Classroom");
  const label = Option.match(use(ThreadShownContext), {
    onNone: () => t("thread-title"),
    onSome: ({ thread }) =>
      isTitled(thread.opening) && thread.opening.discussion !== null
        ? t("discussion-label", {
            number: thread.number,
            title: thread.opening.discussion.title,
          })
        : t("thread-title"),
  });

  return <PaneHeader title={label} />;
}

/**
 * The opening message of the thread and its replies, as the pane read them, so it opens where the viewer stopped
 * reading. Older replies load as the oldest loaded one comes into view, and the opening message stands above them
 * once every reply is loaded. A failed read shows its sentence and Try again, and a viewer who lost the school's
 * access is sent to the refused page.
 */
function ThreadReplies() {
  return Option.match(use(ThreadShownContext), {
    onNone: () => null,
    onSome: ({ feed: { read, replies }, thread }) => {
      if (
        PaginatedQueryResult.isFailure(replies) &&
        isLostAccess(replies.error)
      ) {
        throw replies.error;
      }
      if (
        PaginatedQueryResult.isFailure(replies) ||
        QueryResult.isFailure(read)
      ) {
        return (
          <div className="flex-1 p-4">
            <LoadFailure onRetry={reloadPage} />
          </div>
        );
      }
      return (
        <MessageStream
          at={QueryResult.isSuccess(read) ? read.value.at : null}
          loadOlder={
            PaginatedQueryResult.isCanLoadMore(replies)
              ? () => replies.loadMore(MESSAGE_PAGE_SIZE)
              : undefined
          }
          messages={Arr.reverse(replies.results)}
          opening={Option.some(thread.opening)}
        />
      );
    },
  });
}
