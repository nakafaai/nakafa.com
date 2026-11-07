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
import { Array as Arr, Option } from "effect";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { PaneHeader } from "@/components/shared/pane";
import { PanesDetail } from "@/components/shared/panes";
import { reloadPage } from "@/components/shared/reload";
import { LoadFailure } from "@/components/state/failure";
import { MESSAGE_PAGE_SIZE } from "@/components/tenant/classes/forum/channel";
import { ForumComposer } from "@/components/tenant/classes/forum/composer";
import {
  type OpenedThread,
  useOpening,
} from "@/components/tenant/classes/forum/open";
import {
  ChannelScopeContext,
  useChannelScope,
  useReadPlace,
} from "@/components/tenant/classes/forum/scope";
import { MessageStream } from "@/components/tenant/classes/forum/stream";
import { useClassScope } from "@/components/tenant/classes/scope";
import { isLostAccess } from "@/components/tenant/refusal";
import { schoolClassChannelTarget } from "@/lib/routing/school/target";

/** The thread the pane shows. */
type ShownThread = typeof OpenedThread.Type;

/**
 * The label of a thread: its number and title, the title the server gave it, or the one it takes from its opening
 * message while that answer is on its way.
 */
function useThreadLabel(thread: ShownThread) {
  const t = useTranslations("Classroom");

  return t("discussion-label", {
    number: thread.number,
    title: thread.opening.discussion?.title ?? threadTitle(thread.opening),
  });
}

/**
 * The thread pane of a chat (ADR 0025), as Slack and Discord open a thread: from the shell's top to the screen's
 * bottom at its right, beside the chat, which stays where it was; on a phone it is a sheet over the chat. The
 * discussion's address holds it open, so closing it, from its header's button, Escape or the sheet, leads back to its
 * chat. Its header holds its number and title, its body the opening message and the replies, and its footer the
 * composer, for a member of the class or a subject teacher. Each thread draws in its own body, so a move to another
 * thread never shows the last one's replies under the next one's opening message.
 */
export function ThreadPane({
  canManage,
  canPost,
  everyone,
  jump,
  thread,
}: {
  canManage: boolean;
  canPost: boolean;
  /** Whether the viewer, a subject teacher, may mention everyone. */
  everyone: boolean;
  jump: Option.Option<Id<"classroomMessages">>;
  thread: Option.Option<ShownThread>;
}) {
  const navigate = useNavigate();
  const { classId, classSlug, slug } = useClassScope();
  const forget = useOpening((state) => state.forget);
  // The thread the pane showed last stays in the phone's sheet while the sheet slides away, so it never empties
  // before it is gone.
  const [last, setLast] = useState(thread);
  if (
    Option.isSome(thread) &&
    !Option.exists(
      last,
      (kept) =>
        kept.opening.clientKey === thread.value.opening.clientKey &&
        kept.number === thread.value.number
    )
  ) {
    setLast(thread);
  }
  const shown = Option.isSome(thread) ? thread : last;

  return (
    <PanesDetail
      label={Option.match(shown, {
        onNone: () => "",
        onSome: (kept) =>
          kept.opening.discussion?.title ?? threadTitle(kept.opening),
      })}
      onClose={() => {
        forget();
        Option.map(shown, (kept) =>
          navigate(schoolClassChannelTarget(slug, classSlug, kept.channelId))
        );
      }}
      open={Option.isSome(thread)}
    >
      {Option.match(shown, {
        onNone: () => null,
        onSome: (kept) => (
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
            <ThreadContent key={kept.opening.clientKey} thread={kept} />
          </ChannelScopeContext>
        ),
      })}
    </PanesDetail>
  );
}

/** One thread in the pane: its header, its messages, and the composer or the sentence that says who writes. */
function ThreadContent({ thread }: { thread: ShownThread }) {
  const t = useTranslations("Classroom");
  const { canPost } = useChannelScope();
  const label = useThreadLabel(thread);

  return (
    <>
      <PaneHeader title={label} />
      <div className="flex min-h-0 flex-1 flex-col" data-slot="discussion">
        <ThreadReplies thread={thread} />
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
 * The opening message of the thread and its replies, read once Convex has settled the session with the viewer's read
 * mark in the thread, so it opens where the viewer stopped reading. A thread its summary says holds no reply shows its
 * opening message at once. Older replies load as the oldest loaded one comes into view, and the opening message
 * stands above them once every reply is loaded. A failed read shows its sentence and Try again, and a viewer who lost
 * the school's access is sent to the refused page.
 */
function ThreadReplies({ thread }: { thread: ShownThread }) {
  const { classId, slug } = useChannelScope();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const place = useReadPlace();
  const pagination = usePaginatedQuery(
    classroom.forum.threads.replies,
    isSettled ? { classId, number: thread.number, slug } : "skip",
    { initialNumItems: MESSAGE_PAGE_SIZE }
  );
  const read = useQuery(
    classroom.forum.reads.get,
    isSettled ? { classId, place, slug } : "skip"
  );
  // A thread that held no reply when it opened draws at once: nothing it waits for can stand above its opening message.
  const empty = thread.opening.discussion?.replies === 0;

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
  if (
    !empty &&
    (pagination._tag === "LoadingFirstPage" || !QueryResult.isSuccess(read))
  ) {
    return <div className="flex-1" />;
  }

  return (
    <MessageStream
      at={QueryResult.isSuccess(read) ? read.value.at : null}
      loadOlder={
        PaginatedQueryResult.isCanLoadMore(pagination)
          ? () => pagination.loadMore(MESSAGE_PAGE_SIZE)
          : undefined
      }
      messages={Arr.reverse(pagination.results)}
      opening={Option.some(thread.opening)}
    />
  );
}
