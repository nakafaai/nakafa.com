import { PaginatedQueryResult } from "@confect/react";
import type { Id } from "@repo/backend/confect/_generated/id";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerViewport,
} from "@repo/design-system/components/ui/scroller";
import { MessageScroller as Primitive } from "@shadcn/react/message-scroller";
import { Array as Arr, Option } from "effect";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import { TableEmpty } from "@/components/shared/table/frame";
import { ForumComposer } from "@/components/tenant/classes/forum/composer";
import { ForumMessageRow } from "@/components/tenant/classes/forum/message";
import {
  ChannelScopeContext,
  useChannelScope,
} from "@/components/tenant/classes/forum/scope";
import { isLostAccess } from "@/components/tenant/refusal";
import { usePaginatedPreloaded } from "@/lib/data/paginated";

/** How many messages a channel reads each time its oldest loaded message comes into view. */
const MESSAGE_PAGE_SIZE = 30;

/**
 * One channel of a class: its messages, oldest at the top and the newest at the bottom, where the
 * channel opens, and the composer under them for a member of the class or a subject teacher. The
 * school's leaders read the channel and write in none, so they see a sentence that says who writes
 * there in place of the composer.
 */
export function ForumChannel({
  canManage,
  canPost,
  channelId,
  classId,
  slug,
}: {
  canManage: boolean;
  canPost: boolean;
  channelId: Id<"classroomChannels">;
  classId: Id<"classes">;
  slug: TenantSlug;
}) {
  const t = useTranslations("Classroom");

  return (
    <ChannelScopeContext value={{ canManage, channelId, classId, slug }}>
      <div className="flex h-[70dvh] min-h-96 w-full min-w-0 flex-col gap-3">
        <ChannelMessages />
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
 * The messages of the channel in a scroller that keeps the reader's place. The channel reads its
 * newest page once Convex has settled the session, and the next older page when the oldest loaded
 * message comes into view, so the list has no button. A channel with no message shows its empty
 * state, a failed read its sentence and Try again, and a viewer who lost the school's access is
 * sent to the refused page.
 */
function ChannelMessages() {
  const t = useTranslations("Classroom");
  const { channelId, classId, slug } = useChannelScope();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const pagination = usePaginatedPreloaded(
    classroom.forum.messages.page,
    isSettled ? { channelId, classId, slug } : "skip",
    { initialNumItems: MESSAGE_PAGE_SIZE },
    Option.none()
  );
  if (
    PaginatedQueryResult.isFailure(pagination) &&
    isLostAccess(pagination.error)
  ) {
    throw pagination.error;
  }
  if (PaginatedQueryResult.isFailure(pagination)) {
    return <DataFailure onRetry={reloadPage} />;
  }
  if (pagination._tag === "LoadingFirstPage") {
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
  const loadOlder = PaginatedQueryResult.isCanLoadMore(pagination)
    ? () => pagination.loadMore(MESSAGE_PAGE_SIZE)
    : undefined;
  const messages = Arr.reverse(pagination.results);

  return (
    <Primitive.Provider autoScroll defaultScrollPosition="end">
      <MessageScroller className="flex-1">
        <MessageScrollerViewport
          aria-label={t("messages")}
          preserveScrollOnPrepend
        >
          <MessageScrollerContent className="mx-auto w-full max-w-3xl gap-4 py-2">
            {Arr.map(messages, (message, index) => (
              // The client key stays the same from the send to the server's answer, so the row
              // and anything open in it outlive the placeholder ID.
              <MessageScrollerItem
                key={message.clientKey}
                messageId={message.clientKey}
              >
                {index === 0 && loadOlder ? (
                  <Intersection onIntersect={loadOlder} />
                ) : null}
                <ForumMessageRow
                  message={message}
                  opens={Option.match(Arr.get(messages, index - 1), {
                    onNone: () => true,
                    onSome: (previous) =>
                      previous.author.id !== message.author.id,
                  })}
                />
              </MessageScrollerItem>
            ))}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton aria-label={t("scroll-to-latest")} />
      </MessageScroller>
    </Primitive.Provider>
  );
}
