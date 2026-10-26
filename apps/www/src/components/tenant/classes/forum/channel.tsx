import { PaginatedQueryResult, QueryResult, useQuery } from "@confect/react";
import type { Id } from "@repo/backend/confect/_generated/id";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { Array as Arr, Option } from "effect";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import { TableEmpty } from "@/components/shared/table/frame";
import { ForumComposer } from "@/components/tenant/classes/forum/composer";
import {
  ChannelScopeContext,
  useChannelScope,
} from "@/components/tenant/classes/forum/scope";
import { MessageStream } from "@/components/tenant/classes/forum/stream";
import { useClassScope } from "@/components/tenant/classes/scope";
import { isLostAccess } from "@/components/tenant/refusal";
import { usePaginatedPreloaded } from "@/lib/data/paginated";

/** How many messages a place reads each time its oldest loaded message comes into view. */
export const MESSAGE_PAGE_SIZE = 30;

/**
 * One channel of a class: its messages, oldest at the top and the newest at the bottom, and the
 * composer under them for a member of the class or a subject teacher. The school's leaders read the
 * channel and write in none, so they see a sentence that says who writes there in place of the
 * composer.
 */
export function ForumChannel({
  canManage,
  canPost,
  channelId,
  everyone,
  jump,
}: {
  canManage: boolean;
  canPost: boolean;
  channelId: Id<"classroomChannels">;
  /** Whether the viewer, a subject teacher, may mention everyone. */
  everyone: boolean;
  jump: Option.Option<Id<"classroomMessages">>;
}) {
  const t = useTranslations("Classroom");
  const { classId, slug } = useClassScope();

  return (
    <ChannelScopeContext
      value={{
        canManage,
        channelId,
        classId,
        discussion: undefined,
        everyone,
        slug,
      }}
    >
      <div className="flex h-[70dvh] min-h-96 w-full min-w-0 flex-col gap-3">
        <ChannelMessages jump={jump} key={channelId} />
        {canPost ? (
          <ForumComposer />
        ) : (
          <p className="text-center text-muted-foreground text-sm">
            {t("read-only")}
          </p>
        )}
      </div>
    </ChannelScopeContext>
  );
}

/**
 * The messages of the channel, read once Convex has settled the session with the viewer's read
 * mark, so the channel opens where the viewer stopped reading. The next older page loads when the
 * oldest loaded message comes into view, so the list has no button. A channel with no message shows
 * its empty state, a failed read its sentence and Try again, and a viewer who lost the school's
 * access is sent to the refused page.
 */
function ChannelMessages({
  jump,
}: {
  jump: Option.Option<Id<"classroomMessages">>;
}) {
  const t = useTranslations("Classroom");
  const { channelId, classId, slug } = useChannelScope();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const place = { _tag: "channel" as const, channelId };
  const pagination = usePaginatedPreloaded(
    classroom.forum.messages.page,
    isSettled ? { channelId, classId, slug } : "skip",
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
  if (Arr.isReadonlyArrayEmpty(pagination.results)) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <TableEmpty
          act="typing"
          description={t("messages-empty-description")}
          title={t("messages-empty")}
        />
      </div>
    );
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
      place={place}
    />
  );
}
