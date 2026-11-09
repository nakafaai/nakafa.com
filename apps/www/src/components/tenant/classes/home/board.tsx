import {
  PaginatedQueryResult,
  QueryResult,
  usePaginatedQuery,
  useQuery,
} from "@confect/react";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { ItemGroup } from "@repo/design-system/components/ui/item";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { reloadPage } from "@/components/shared/reload";
import { EmptyState } from "@/components/state/empty";
import { LoadFailure } from "@/components/state/failure";
import { EmptyNina } from "@/components/state/nina";
import { PostRow } from "@/components/tenant/classes/home/post";
import { WaitingPosts } from "@/components/tenant/classes/home/scheduled";
import { useClassScope } from "@/components/tenant/classes/scope";
import { isLostAccess } from "@/components/tenant/refusal";

/** How many announcements the home reads each time the end of its list comes into view. */
const POST_PAGE_SIZE = 20;

/** The reads of a class's home, which wait for the session and, for what is scheduled, for the right to publish. */
function useClassPosts(archived: boolean) {
  const { can, classId, slug } = useClassScope();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const publishes = Arr.contains(can, "post.publish");

  return {
    pagination: usePaginatedQuery(
      classroom.posts.list,
      isSettled ? { classId, slug, ...(archived ? { archived } : {}) } : "skip",
      { initialNumItems: POST_PAGE_SIZE }
    ),
    pinned: useQuery(
      classroom.posts.pinned,
      isSettled && !archived ? { classId, slug } : "skip"
    ),
    publishes,
    scheduled: useQuery(
      classroom.scheduled.list,
      isSettled && publishes && !archived ? { classId, slug } : "skip"
    ),
  };
}

/**
 * The home of a class: what a teacher keeps for later, its pinned announcements, then the others, newest first
 * (ADR 0025), or its archived announcements for a teacher who chose them. The next page loads when the end of the list comes into view, so the list has no button. A class with no announcement shows
 * its empty state, a failed read its sentence and Try again, and a viewer who lost the school's
 * access is sent to the refused page.
 */
export function ClassHome({ archived }: { archived: boolean }) {
  const t = useTranslations("Classroom");
  const { pagination, pinned, publishes, scheduled } = useClassPosts(archived);
  if (
    PaginatedQueryResult.isFailure(pagination) &&
    isLostAccess(pagination.error)
  ) {
    throw pagination.error;
  }
  if (
    PaginatedQueryResult.isFailure(pagination) ||
    QueryResult.isFailure(pinned)
  ) {
    return <LoadFailure onRetry={reloadPage} />;
  }
  if (archived) {
    return <ArchivedPosts pagination={pagination} />;
  }
  // Every read arrives before the list draws, so a pinned announcement never jumps to the top and a
  // kept one never pushes the list down.
  if (
    pagination._tag === "LoadingFirstPage" ||
    !QueryResult.isSuccess(pinned) ||
    (publishes && QueryResult.isLoading(scheduled))
  ) {
    return null;
  }

  return (
    <>
      {QueryResult.isSuccess(scheduled) ? (
        <WaitingPosts posts={scheduled.value} />
      ) : null}
      {Arr.isReadonlyArrayEmpty(pagination.results) ? (
        <EmptyState
          description={t("posts-empty-description")}
          scene={<EmptyNina act="reading" />}
          title={t("posts-empty")}
        />
      ) : (
        <ItemGroup aria-label={t("posts")}>
          {Arr.map(pinned.value, (post) => (
            <PostRow key={post.clientKey} post={post} />
          ))}
          {Arr.map(
            Arr.filter(pagination.results, (post) => !post.pinned),
            (post) => (
              <PostRow key={post.clientKey} post={post} />
            )
          )}
        </ItemGroup>
      )}
      {PaginatedQueryResult.isCanLoadMore(pagination) ? (
        <Intersection onIntersect={() => pagination.loadMore(POST_PAGE_SIZE)} />
      ) : null}
    </>
  );
}

/** The class's archived announcements, newest first, each with Restore in its menu; an empty shelf says so. */
function ArchivedPosts({
  pagination,
}: {
  pagination: ReturnType<typeof useClassPosts>["pagination"];
}) {
  const t = useTranslations("Classroom");
  const tCommon = useTranslations("Common");

  if (pagination._tag === "LoadingFirstPage") {
    return null;
  }

  return (
    <>
      {Arr.isReadonlyArrayEmpty(pagination.results) ? (
        <EmptyState
          description={t("posts-archived-empty-description")}
          scene={<EmptyNina act="reading" />}
          title={t("posts-archived-empty")}
        />
      ) : (
        <ItemGroup aria-label={tCommon("archived")}>
          {Arr.map(pagination.results, (post) => (
            <PostRow key={post.clientKey} post={post} />
          ))}
        </ItemGroup>
      )}
      {PaginatedQueryResult.isCanLoadMore(pagination) ? (
        <Intersection onIntersect={() => pagination.loadMore(POST_PAGE_SIZE)} />
      ) : null}
    </>
  );
}
