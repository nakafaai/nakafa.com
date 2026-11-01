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
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import { TableEmpty } from "@/components/shared/table/frame";
import { PostRow } from "@/components/tenant/classes/home/post";
import { WaitingPosts } from "@/components/tenant/classes/home/scheduled";
import { useClassScope } from "@/components/tenant/classes/scope";
import { isLostAccess } from "@/components/tenant/refusal";

/** How many announcements the home reads each time the end of its list comes into view. */
const POST_PAGE_SIZE = 20;

/**
 * The home of a class: what a teacher keeps for later, its pinned announcements, then the others, newest first
 * (ADR 0025). The next page loads when the end of the list comes into view, so the list has no button. A class with no announcement shows
 * its empty state, a failed read its sentence and Try again, and a viewer who lost the school's
 * access is sent to the refused page.
 */
export function ClassHome() {
  const { can } = useClassScope();

  return (
    <>
      {Arr.contains(can, "post.publish") ? <WaitingPosts /> : null}
      <ClassPosts />
    </>
  );
}

/** The posts of the class, the pinned ones first. */
function ClassPosts() {
  const t = useTranslations("Classroom");
  const { classId, slug } = useClassScope();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const pagination = usePaginatedQuery(
    classroom.posts.list,
    isSettled ? { classId, slug } : "skip",
    { initialNumItems: POST_PAGE_SIZE }
  );
  const pinned = useQuery(
    classroom.posts.pinned,
    isSettled ? { classId, slug } : "skip"
  );
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
    return <DataFailure onRetry={reloadPage} />;
  }
  // Both reads arrive before the list draws, so a pinned announcement never jumps to the top.
  if (
    pagination._tag === "LoadingFirstPage" ||
    !QueryResult.isSuccess(pinned)
  ) {
    return null;
  }
  if (Arr.isReadonlyArrayEmpty(pagination.results)) {
    return (
      <TableEmpty
        act="reading"
        description={t("posts-empty-description")}
        title={t("posts-empty")}
      />
    );
  }

  return (
    <>
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
      {PaginatedQueryResult.isCanLoadMore(pagination) ? (
        <Intersection onIntersect={() => pagination.loadMore(POST_PAGE_SIZE)} />
      ) : null}
    </>
  );
}
