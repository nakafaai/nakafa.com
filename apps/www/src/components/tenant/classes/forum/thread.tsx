import type { Ref } from "@confect/core";
import { PaginatedQueryResult, QueryResult, useQuery } from "@confect/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import type { Id } from "@repo/backend/confect/_generated/id";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { buttonVariants } from "@repo/design-system/lib/button";
import { Array as Arr, Option } from "effect";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import {
  ForumChannel,
  MESSAGE_PAGE_SIZE,
} from "@/components/tenant/classes/forum/channel";
import { ForumComposer } from "@/components/tenant/classes/forum/composer";
import {
  ChannelScopeContext,
  useChannelScope,
} from "@/components/tenant/classes/forum/scope";
import { MessageStream } from "@/components/tenant/classes/forum/stream";
import { useClassScope } from "@/components/tenant/classes/scope";
import { isLostAccess } from "@/components/tenant/refusal";
import { usePaginatedPreloaded } from "@/lib/data/paginated";
import { TargetLink } from "@/lib/routing/link";
import { schoolClassChannelTarget } from "@/lib/routing/school/target";

/** One discussion as its page shows it. */
type Thread = Ref.Returns<typeof classroom.forum.threads.get>;

/**
 * One numbered discussion of a class (ADR 0025). From tablet width it opens as a panel beside its
 * channel, which stays readable; on a phone it opens as a sheet over its channel, which the close
 * button or a press beside the sheet closes. CSS alone decides the two, so the server's page and
 * the first paint already match the screen. Its opening message stands first, its replies follow, and the composer under them
 * replies, for a member of the class or a subject teacher.
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
  const { classId, classSlug, slug } = useClassScope();
  const title = t("discussion-label", {
    number: thread.discussion.number,
    title: thread.discussion.title,
  });

  return (
    <div className="grid w-full min-w-0 gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
      <div className="flex min-w-0">
        <ForumChannel
          canManage={canManage}
          canPost={canPost}
          channelId={thread.channelId}
          everyone={everyone}
          jump={Option.none()}
        />
      </div>
      {/* On a phone the discussion is a sheet over its channel, and a press beside it closes it. */}
      <TargetLink
        aria-hidden="true"
        className="fixed inset-0 z-40 bg-black/40 md:hidden"
        tabIndex={-1}
        target={schoolClassChannelTarget(slug, classSlug, thread.channelId)}
      />
      <section
        aria-label={title}
        className="flex min-h-96 min-w-0 flex-col gap-3 max-md:fixed max-md:inset-x-0 max-md:top-24 max-md:bottom-0 max-md:z-50 max-md:rounded-t-2xl max-md:border-t max-md:bg-background max-md:px-4 max-md:pt-4 max-md:pb-4 max-md:shadow-lg md:h-[70dvh] md:border-s md:ps-6"
        data-slot="discussion"
      >
        <div className="flex min-w-0 items-start justify-between gap-2">
          <h2 className="wrap-anywhere min-w-0 font-semibold" dir="auto">
            {title}
          </h2>
          <TargetLink
            aria-label={t("discussion-close")}
            className={buttonVariants({
              className: "shrink-0",
              size: "icon-sm",
              variant: "ghost",
            })}
            target={schoolClassChannelTarget(slug, classSlug, thread.channelId)}
          >
            <HugeIcons icon={Cancel01Icon} />
          </TargetLink>
        </div>
        <ChannelScopeContext
          value={{
            canManage,
            channelId: thread.channelId,
            classId,
            discussion: thread.discussion.number,
            everyone,
            slug,
          }}
        >
          <DiscussionReplies
            jump={jump}
            key={thread.discussion.number}
            number={thread.discussion.number}
            opening={thread.opening}
          />
          {canPost ? (
            <ForumComposer />
          ) : (
            <p className="text-center text-muted-foreground text-sm">
              {t("read-only")}
            </p>
          )}
        </ChannelScopeContext>
      </section>
    </div>
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
  jump,
  number,
  opening,
}: {
  jump: Option.Option<Id<"classroomMessages">>;
  number: number;
  opening: Thread["opening"];
}) {
  const { classId, slug } = useChannelScope();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const place = { _tag: "discussion" as const, number };
  const pagination = usePaginatedPreloaded(
    classroom.forum.threads.replies,
    isSettled ? { classId, number, slug } : "skip",
    { initialNumItems: MESSAGE_PAGE_SIZE },
    Option.none()
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
    return <DataFailure onRetry={reloadPage} />;
  }
  if (pagination._tag === "LoadingFirstPage" || !QueryResult.isSuccess(read)) {
    return <div className="flex-1" />;
  }

  return (
    <MessageStream
      at={read.value.at}
      jump={jump}
      loadOlder={
        PaginatedQueryResult.isCanLoadMore(pagination)
          ? () => pagination.loadMore(MESSAGE_PAGE_SIZE)
          : undefined
      }
      messages={Arr.reverse(pagination.results)}
      opening={Option.some(opening)}
      place={place}
    />
  );
}
