import type { Ref } from "@confect/core";
import {
  PaginatedQueryResult,
  QueryResult,
  usePaginatedQuery,
  useQuery,
} from "@confect/react";
import type { Id } from "@repo/backend/confect/_generated/id";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { useNavigate } from "@tanstack/react-router";
import { Array as Arr, Option } from "effect";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { DataFailure } from "@/components/shared/failure";
import { PaneHeader } from "@/components/shared/pane";
import {
  Panes,
  PanesDetail,
  PanesList,
  PanesProvider,
} from "@/components/shared/panes";
import { reloadPage } from "@/components/shared/reload";
import {
  ForumChannel,
  MESSAGE_PAGE_SIZE,
} from "@/components/tenant/classes/forum/channel";
import { ForumComposer } from "@/components/tenant/classes/forum/composer";
import {
  ChannelScopeContext,
  useChannelScope,
  useReadPlace,
} from "@/components/tenant/classes/forum/scope";
import { MessageStream } from "@/components/tenant/classes/forum/stream";
import { useClassScope } from "@/components/tenant/classes/scope";
import { isLostAccess } from "@/components/tenant/refusal";
import { schoolClassChannelTarget } from "@/lib/routing/school/target";

/** One discussion as its page shows it. */
type Thread = Ref.Returns<typeof classroom.forum.threads.get>;

/**
 * One numbered discussion of a class (ADR 0025), as a chat's thread panel on the page's shared
 * panes: from tablet width it stands beside its channel, which stays readable, and the handle
 * between the two resizes them; on a phone it is a sheet over its channel. Its address holds it
 * open, so closing it, from its header's button or the sheet's, leads back to its channel. Its
 * header holds its title, its body the opening message and the replies, and its footer the
 * composer, for a member of the class or a subject teacher.
 */
export function ForumDiscussion({
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
  thread: Thread;
}) {
  const t = useTranslations("Classroom");
  const navigate = useNavigate();
  const { classId, classSlug, slug } = useClassScope();
  const title = t("discussion-label", {
    number: thread.discussion.number,
    title: thread.discussion.title,
  });

  return (
    <PanesProvider>
      <Panes fill="parent">
        <PanesList>
          <ForumChannel
            canManage={canManage}
            canPost={canPost}
            channelId={thread.channelId}
            everyone={everyone}
            jump={Option.none()}
          />
        </PanesList>
        <PanesDetail
          label={title}
          onClose={() =>
            navigate(
              schoolClassChannelTarget(slug, classSlug, thread.channelId)
            )
          }
          open
        >
          <PaneHeader title={title} />
          <div className="flex min-h-0 flex-1 flex-col" data-slot="discussion">
            <ChannelScopeContext
              value={{
                canManage,
                channelId: thread.channelId,
                classId,
                discussion: thread.discussion.number,
                everyone,
                jump,
                slug,
              }}
            >
              <DiscussionReplies
                key={thread.discussion.number}
                number={thread.discussion.number}
                opening={thread.opening}
              />
              <footer className="shrink-0 px-4 pt-2 pb-4">
                {canPost ? (
                  <ForumComposer />
                ) : (
                  <p className="text-center text-muted-foreground text-sm">
                    {t("read-only")}
                  </p>
                )}
              </footer>
            </ChannelScopeContext>
          </div>
        </PanesDetail>
      </Panes>
    </PanesProvider>
  );
}

/**
 * The opening message of the discussion and its replies, read once Convex has settled the session
 * with the viewer's read mark in the discussion, so it opens where the viewer stopped reading. Older
 * replies load as the oldest loaded one comes into view, and the opening message stands above them
 * once every reply is loaded. A failed read shows its sentence and Try again, and a viewer who lost
 * the school's access is sent to the refused page.
 */
function DiscussionReplies({
  number,
  opening,
}: {
  number: number;
  opening: Thread["opening"];
}) {
  const { classId, slug } = useChannelScope();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const place = useReadPlace();
  const pagination = usePaginatedQuery(
    classroom.forum.threads.replies,
    isSettled ? { classId, number, slug } : "skip",
    { initialNumItems: MESSAGE_PAGE_SIZE }
  );
  const read = useQuery(
    classroom.forum.reads.get,
    isSettled ? { classId, place, slug } : "skip"
  );
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
        <DataFailure onRetry={reloadPage} />
      </div>
    );
  }
  if (pagination._tag === "LoadingFirstPage" || !QueryResult.isSuccess(read)) {
    return <div className="flex-1" />;
  }

  return (
    <MessageStream
      at={read.value.at}
      loadOlder={
        PaginatedQueryResult.isCanLoadMore(pagination)
          ? () => pagination.loadMore(MESSAGE_PAGE_SIZE)
          : undefined
      }
      messages={Arr.reverse(pagination.results)}
      opening={Option.some(opening)}
    />
  );
}
